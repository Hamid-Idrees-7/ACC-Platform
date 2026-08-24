using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class ProjectService : IProjectService
    {
        private readonly IProjectRepository _repository;
        private readonly IClientRepository _clientRepository;
        private readonly IMaterialRepository _materialRepository;
        private readonly IAssignmentRepository _assignmentRepository;
        private readonly IEmployeeRepository _employeeRepository;

        private static readonly string[] StandardPhases =
        {
            "Foundation",
            "Grey Structure",
            "Brickwork / Masonry",
            "Electrical",
            "Plumbing",
            "Plaster",
            "Flooring & Tiles",
            "Finishing & Paint"
        };

        private static readonly string[] AllowedStatuses =
        {
            "In Progress", "On Hold", "Completed", "Cancelled"
        };

        public ProjectService(
            IProjectRepository repository,
            IClientRepository clientRepository,
            IMaterialRepository materialRepository,
            IAssignmentRepository assignmentRepository,
            IEmployeeRepository employeeRepository)
        {
            _repository = repository;
            _clientRepository = clientRepository;
            _materialRepository = materialRepository;
            _assignmentRepository = assignmentRepository;
            _employeeRepository = employeeRepository;
        }

        public async Task<List<ProjectDto>> GetAllProjectsAsync()
        {
            var projects = await _repository.GetAllAsync();
            var allPhases = await _repository.GetAllPhasesAsync();
            var phasesByProject = allPhases
                .GroupBy(p => p.ProjectID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var clients = await _clientRepository.GetAllAsync();
            var clientNames = clients.ToDictionary(c => c.ClientID, c => c.FullName);

            return projects.Select(p =>
            {
                phasesByProject.TryGetValue(p.ProjectID, out var phases);
                return MapDto(p, clientNames.GetValueOrDefault(p.ClientID, "—"), OverallProgress(phases));
            }).ToList();
        }

        public async Task<ProjectDetailDto?> GetProjectDetailAsync(int id)
        {
            var project = await _repository.GetByIdAsync(id);
            if (project == null) return null;

            var client = await _clientRepository.GetByIdAsync(project.ClientID);
            var phases = await _repository.GetPhasesAsync(id);

            // Material cost is the total value of stock issued to this project.
            var issues = await _materialRepository.GetIssuesByProjectAsync(id);
            decimal materialCost = issues.Sum(t => t.Quantity * t.Rate);

            // Labour cost, for now, is only the contract wages — a fixed agreed amount.
            // Daily and monthly wages depend on attendance and are added once that module exists.
            decimal labourCost = await _assignmentRepository.GetContractLabourForProjectAsync(id);

            decimal actualCost = materialCost + labourCost;
            decimal profit = project.Budget - actualCost;
            decimal margin = project.Budget > 0 ? Math.Round(profit / project.Budget * 100m, 0) : 0m;

            var phaseNames = phases.ToDictionary(p => p.PhaseID, p => p.Name);
            var materialsByPhase = issues
                .GroupBy(t => t.PhaseID)
                .Select(g => new PhaseMaterialsDto
                {
                    PhaseName = g.Key.HasValue && phaseNames.ContainsKey(g.Key.Value)
                        ? phaseNames[g.Key.Value]
                        : "Unassigned",
                    Subtotal = g.Sum(t => t.Quantity * t.Rate),
                    Items = g
                        .GroupBy(x => new
                        {
                            x.MaterialID,
                            Name = x.Material != null ? x.Material.Name : "—",
                            Unit = x.Material != null ? x.Material.Unit : ""
                        })
                        .Select(mg => new PhaseMaterialLineDto
                        {
                            MaterialName = mg.Key.Name,
                            Unit = mg.Key.Unit,
                            Quantity = mg.Sum(x => x.Quantity),
                            Amount = mg.Sum(x => x.Quantity * x.Rate)
                        })
                        .ToList()
                })
                .OrderByDescending(pm => pm.Subtotal)
                .ToList();

            // Site team — everyone assigned to this project, with their employee names resolved.
            var assignments = await _assignmentRepository.GetByProjectAsync(id);
            var employees = await _employeeRepository.GetAllAsync();
            var employeeNames = employees.ToDictionary(e => e.EmployeeID, e => e.FullName);
            var team = assignments.Select(a => new AssignmentDto
            {
                AssignmentID = a.AssignmentID,
                EmployeeID = a.EmployeeID,
                EmployeeName = employeeNames.GetValueOrDefault(a.EmployeeID, "—"),
                ProjectID = a.ProjectID,
                ProjectTitle = project.Title,
                Role = a.Role,
                WageType = a.WageType,
                WageAmount = a.WageAmount,
                StartDate = a.StartDate,
                EndDate = a.EndDate,
                Status = a.Status,
                Notes = a.Notes,
                CreatedAt = a.CreatedAt
            }).ToList();

            return new ProjectDetailDto
            {
                ProjectID = project.ProjectID,
                Title = project.Title,
                ClientID = project.ClientID,
                ClientName = client?.FullName ?? "—",
                ClientPhone = client?.Phone,
                ProjectType = project.ProjectType,
                AreaSize = project.AreaSize,
                Location = project.Location,
                Description = project.Description,
                StartDate = project.StartDate,
                ExpectedEndDate = project.ExpectedEndDate,
                Budget = project.Budget,
                Status = project.Status,
                OverallProgress = OverallProgress(phases),
                Financials = new ProjectFinancialsDto
                {
                    Budget = project.Budget,
                    MaterialCost = materialCost,
                    LabourCost = labourCost,
                    ActualCost = actualCost,
                    Profit = profit,
                    MarginPercent = margin
                },
                Phases = phases.Select(PhaseDto).ToList(),
                Team = team,
                MaterialsByPhase = materialsByPhase,
                CreatedAt = project.CreatedAt
            };
        }

        public async Task<ProjectDto> CreateProjectAsync(CreateProjectDto dto)
        {
            var project = new Project
            {
                Title = dto.Title.Trim(),
                ClientID = dto.ClientID,
                ProjectType = dto.ProjectType.Trim(),
                AreaSize = dto.AreaSize.Trim(),
                Location = dto.Location.Trim(),
                Description = dto.Description?.Trim(),
                StartDate = dto.StartDate,
                ExpectedEndDate = dto.ExpectedEndDate,
                Budget = dto.Budget,
                Status = "In Progress",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            var created = await _repository.AddAsync(project);

            if (dto.CreateStandardPhases)
            {
                var phases = StandardPhases.Select((name, i) => new ProjectPhase
                {
                    ProjectID = created.ProjectID,
                    Name = name,
                    OrderNo = i + 1,
                    Status = "Pending",
                    Progress = 0,
                    CreatedAt = DateTime.Now
                }).ToList();
                await _repository.AddPhasesAsync(phases);
            }

            return await ToDtoAsync(created);
        }

        public async Task<ProjectDto?> UpdateProjectAsync(int id, CreateProjectDto dto)
        {
            var project = await _repository.GetByIdAsync(id);
            if (project == null) return null;

            project.Title = dto.Title.Trim();
            project.ClientID = dto.ClientID;
            project.ProjectType = dto.ProjectType.Trim();
            project.AreaSize = dto.AreaSize.Trim();
            project.Location = dto.Location.Trim();
            project.Description = dto.Description?.Trim();
            project.StartDate = dto.StartDate;
            project.ExpectedEndDate = dto.ExpectedEndDate;
            project.Budget = dto.Budget;
            project.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(project);
            return await ToDtoAsync(project);
        }

        public async Task<bool> DeleteProjectAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        // True if any material has been issued to this project — such a project
        // must be Cancelled, not deleted, to protect its cost history.
        public async Task<bool> HasMaterialIssuesAsync(int id)
        {
            var issues = await _materialRepository.GetIssuesByProjectAsync(id);
            return issues.Any();
        }

        public async Task<ProjectDetailDto?> ChangeStatusAsync(int id, string status)
        {
            var newStatus = status?.Trim() ?? "";
            if (!AllowedStatuses.Contains(newStatus)) return null;

            var project = await _repository.GetByIdAsync(id);
            if (project == null) return null;

            project.Status = newStatus;
            project.UpdatedAt = DateTime.Now;
            await _repository.UpdateAsync(project);

            return await GetProjectDetailAsync(id);
        }

        public async Task<ProjectPhaseDto?> AddPhaseAsync(int projectId, CreatePhaseDto dto)
        {
            var project = await _repository.GetByIdAsync(projectId);
            if (project == null) return null;

            var phases = await _repository.GetPhasesAsync(projectId);
            var nextOrder = phases.Count == 0 ? 1 : phases.Max(p => p.OrderNo) + 1;

            var phase = new ProjectPhase
            {
                ProjectID = projectId,
                Name = dto.Name.Trim(),
                OrderNo = nextOrder,
                Status = "Pending",
                Progress = 0,
                CreatedAt = DateTime.Now
            };
            await _repository.AddPhaseAsync(phase);
            return PhaseDto(phase);
        }

        public async Task<ProjectPhaseDto?> UpdatePhaseAsync(int phaseId, UpdatePhaseDto dto)
        {
            var phase = await _repository.GetPhaseByIdAsync(phaseId);
            if (phase == null) return null;

            phase.Status = string.IsNullOrWhiteSpace(dto.Status) ? phase.Status : dto.Status.Trim();
            phase.Progress = Math.Clamp(dto.Progress, 0, 100);

            await _repository.UpdatePhaseAsync(phase);
            return PhaseDto(phase);
        }

        public async Task<bool> DeletePhaseAsync(int phaseId)
        {
            return await _repository.DeletePhaseAsync(phaseId);
        }

        public async Task ReorderPhasesAsync(int projectId, List<int> phaseIds)
        {
            var phases = await _repository.GetPhasesAsync(projectId);
            var byId = phases.ToDictionary(p => p.PhaseID);

            var order = 1;
            var toUpdate = new List<ProjectPhase>();
            foreach (var pid in phaseIds)
            {
                if (byId.TryGetValue(pid, out var phase))
                {
                    phase.OrderNo = order++;
                    toUpdate.Add(phase);
                }
            }

            if (toUpdate.Count > 0)
                await _repository.UpdatePhasesAsync(toUpdate);
        }

        private async Task<ProjectDto> ToDtoAsync(Project project)
        {
            var client = await _clientRepository.GetByIdAsync(project.ClientID);
            var phases = await _repository.GetPhasesAsync(project.ProjectID);
            return MapDto(project, client?.FullName ?? "—", OverallProgress(phases));
        }

        private static int OverallProgress(List<ProjectPhase>? phases)
        {
            if (phases == null || phases.Count == 0) return 0;
            return (int)Math.Round(phases.Average(p => p.Progress));
        }

        private static ProjectDto MapDto(Project p, string clientName, int overallProgress)
        {
            return new ProjectDto
            {
                ProjectID = p.ProjectID,
                Title = p.Title,
                ClientID = p.ClientID,
                ClientName = clientName,
                ProjectType = p.ProjectType,
                AreaSize = p.AreaSize,
                Location = p.Location,
                Budget = p.Budget,
                Status = p.Status,
                StartDate = p.StartDate,
                ExpectedEndDate = p.ExpectedEndDate,
                OverallProgress = overallProgress,
                CreatedAt = p.CreatedAt
            };
        }

        private static ProjectPhaseDto PhaseDto(ProjectPhase ph)
        {
            return new ProjectPhaseDto
            {
                PhaseID = ph.PhaseID,
                Name = ph.Name,
                OrderNo = ph.OrderNo,
                Status = ph.Status,
                Progress = ph.Progress
            };
        }
    }
}
