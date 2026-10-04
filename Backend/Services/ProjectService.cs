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
        private readonly IAttendanceRepository _attendanceRepository;
        private readonly IProjectExpenseRepository _expenseRepository;
        private readonly IBillingRepository _billingRepository;
        private readonly IAssignmentService _assignmentService;
        private readonly IMaterialRequestService _materialRequestService;

        private const decimal MaxBudget = 1_000_000_000_000m;

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
            IEmployeeRepository employeeRepository,
            IAttendanceRepository attendanceRepository,
            IProjectExpenseRepository expenseRepository,
            IBillingRepository billingRepository,
            IAssignmentService assignmentService,
            IMaterialRequestService materialRequestService)
        {
            _repository = repository;
            _clientRepository = clientRepository;
            _materialRepository = materialRepository;
            _assignmentRepository = assignmentRepository;
            _employeeRepository = employeeRepository;
            _attendanceRepository = attendanceRepository;
            _expenseRepository = expenseRepository;
            _billingRepository = billingRepository;
            _assignmentService = assignmentService;
            _materialRequestService = materialRequestService;
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

            // Labour cost is contract wages (fixed) plus daily wages from marked attendance
            // (present days x wage). Monthly salaried staff are company payroll and are not
            // charged to a single project.
            var assignments = await _assignmentRepository.GetByProjectAsync(id);
            var dailyAssignments = assignments.Where(a => a.WageType == "Daily").ToList();
            var presentDays = await _attendanceRepository.GetPresentDayCountsAsync(
                dailyAssignments.Select(a => a.AssignmentID).ToList());

            decimal contractLabour = assignments.Where(a => a.WageType == "Contract").Sum(a => a.WageAmount);
            decimal dailyLabour = dailyAssignments.Sum(a => presentDays.GetValueOrDefault(a.AssignmentID, 0) * a.WageAmount);
            decimal labourCost = contractLabour + dailyLabour;

            // Other project expenses (plot, transfer, taxes, possession...). Only company-borne
            // ones are a cost; recoverable ones are billed back to the client, so they are
            // tracked separately and do not change profit.
            var expenses = await _expenseRepository.GetByProjectAsync(id);
            decimal expenseCost = expenses.Where(e => !e.IsRecoverable).Sum(e => e.Amount);
            var recoverable = expenses.Where(e => e.IsRecoverable).ToList();
            var billedLinks = await _expenseRepository.GetInvoiceLinksAsync(recoverable.Select(e => e.ExpenseID).ToList());
            decimal recoverableTotal = recoverable.Sum(e => e.Amount);
            decimal recoverableInvoiced = recoverable.Where(e => billedLinks.ContainsKey(e.ExpenseID)).Sum(e => e.Amount);

            decimal actualCost = materialCost + labourCost + expenseCost;
            decimal profit = project.Budget - actualCost;
            decimal margin = project.Budget > 0 ? Math.Round(profit / project.Budget * 100m, 0) : 0m;

            // A cancelled project never earns its budget: its result is the work billed (tax
            // included, reimbursements left out) minus what was already spent. Reports uses this too.
            if (project.Status == "Cancelled")
            {
                var invoices = await _billingRepository.GetInvoicesByProjectAsync(id);
                var lines = await _billingRepository.GetItemsByInvoiceIdsAsync(invoices.Select(i => i.InvoiceID).ToList());
                decimal workBilled = lines.Where(x => !x.ExpenseID.HasValue).Sum(x => x.Amount) + invoices.Sum(i => i.TaxAmount);
                profit = workBilled - actualCost;
                margin = 0m;
            }

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

            // Site team: everyone assigned to this project, with employee names filled in.
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
                PresentDays = presentDays.GetValueOrDefault(a.AssignmentID, 0),
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
                    ContractLabour = contractLabour,
                    DailyLabour = dailyLabour,
                    LabourCost = labourCost,
                    ExpenseCost = expenseCost,
                    RecoverableTotal = recoverableTotal,
                    RecoverableInvoiced = recoverableInvoiced,
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
                StartDate = dto.StartDate?.Date,
                ExpectedEndDate = dto.ExpectedEndDate?.Date,
                Budget = Math.Round(dto.Budget, 2),
                Status = "In Progress",
                CreatedAt = AppTime.Now,
                UpdatedAt = AppTime.Now
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
                    CreatedAt = AppTime.Now
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
            project.StartDate = dto.StartDate?.Date;
            project.ExpectedEndDate = dto.ExpectedEndDate?.Date;
            project.Budget = Math.Round(dto.Budget, 2);
            project.UpdatedAt = AppTime.Now;

            await _repository.UpdateAsync(project);
            return await ToDtoAsync(project);
        }

        public async Task<bool> DeleteProjectAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        // Null if the project may be deleted; otherwise the reason it can't be. A project that
        // already has money history (issued materials, expenses or invoices) must be set to
        // Cancelled instead, so that history is never lost.
        public async Task<string?> GetDeleteBlockerAsync(int id)
        {
            var issues = await _materialRepository.GetIssuesByProjectAsync(id);
            if (issues.Any())
                return "This project has issued materials, so it can't be deleted. Set its status to Cancelled instead, or cancel those issues first (the stock comes back).";

            if (await _expenseRepository.AnyForProjectAsync(id))
                return "This project has recorded expenses, so it can't be deleted. Set its status to Cancelled instead, or delete those expenses first.";

            var invoices = await _billingRepository.GetInvoicesByProjectAsync(id);
            if (invoices.Count > 0)
                return "This project has invoices, so it can't be deleted. Set its status to Cancelled instead, or delete those invoices first.";

            // People placed on it carry attendance and pay history.
            if ((await _assignmentRepository.GetByProjectAsync(id)).Count > 0)
                return "This project has assignments, so it can't be deleted. Set its status to Cancelled instead, or remove those assignments first.";

            return null;
        }

        private static readonly string[] PhaseStatuses = { "Pending", "In Progress", "Completed" };

        // A cancelled project is read-only until it is reopened. Null when it can be changed.
        public async Task<string?> CancelledErrorAsync(int projectId)
        {
            var project = await _repository.GetByIdAsync(projectId);
            return project?.Status == "Cancelled"
                ? $"{project.Title} is cancelled, so it can't be changed. Reopen it first by changing its status."
                : null;
        }

        public async Task<int?> PhaseProjectIdAsync(int phaseId) =>
            (await _repository.GetPhaseByIdAsync(phaseId))?.ProjectID;

        // The rules for a new or edited project. Null when it is fine; otherwise the reason.
        public async Task<string?> CheckAsync(CreateProjectDto dto, int? id)
        {
            var client = await _clientRepository.GetByIdAsync(dto.ClientID);
            if (client == null) return "Choose a client.";

            var existing = id == null ? null : await _repository.GetByIdAsync(id.Value);
            if ((existing == null || existing.ClientID != dto.ClientID) && client.Status != "Active")
                return $"{client.FullName} is inactive. Set the client Active first, or choose another client.";

            var today = AppTime.Today;
            if (dto.StartDate is DateTime s && (s.Year < 2000 || s.Date > today.AddYears(10)))
                return "Enter a valid start date.";
            if (dto.ExpectedEndDate is DateTime e && (e.Year < 2000 || e.Date > today.AddYears(20)))
                return "Enter a valid expected end date.";
            if (dto.StartDate != null && dto.ExpectedEndDate != null && dto.ExpectedEndDate.Value.Date < dto.StartDate.Value.Date)
                return "The expected end date can't be before the start date.";

            if (dto.Budget < 0) return "The budget can't be negative.";
            if (dto.Budget > MaxBudget) return "The budget is too large.";
            return null;
        }

        // Completed and Cancelled close the project: its open assignments end today (so pay and
        // site access stop) and waiting material requests are closed. Either can be reopened
        // later; the ended assignments stay ended and people are assigned again.
        public async Task<ProjectStatusResult> ChangeStatusAsync(int id, string status)
        {
            var newStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(status?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (newStatus == null) return new ProjectStatusResult(null, "Choose a valid status.", 0, 0);

            var project = await _repository.GetByIdAsync(id);
            if (project == null) return new ProjectStatusResult(null, null, 0, 0);

            // Assignments are ended and requests closed before the status is saved. If anything
            // fails halfway, the project is still open and saving the status again finishes the
            // job, so a closed project never keeps open assignments. (No transaction here: ending
            // takes each person's salary lock, which must not wait while database rows are held.)
            int ended = 0, closed = 0;
            if (newStatus == "Completed" || newStatus == "Cancelled")
            {
                ended = await _assignmentService.EndOpenAsync(projectId: id);
                closed = await _materialRequestService.CloseForProjectAsync(id, $"The project was marked {newStatus.ToLower()}.");
            }

            project.Status = newStatus;
            project.UpdatedAt = AppTime.Now;
            await _repository.UpdateAsync(project);

            // Once more, for anything added while the first pass ran (nothing new can be added now)
            if (newStatus == "Completed" || newStatus == "Cancelled")
            {
                ended += await _assignmentService.EndOpenAsync(projectId: id);
                closed += await _materialRequestService.CloseForProjectAsync(id, $"The project was marked {newStatus.ToLower()}.");
            }

            return new ProjectStatusResult(await GetProjectDetailAsync(id), null, ended, closed);
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
                CreatedAt = AppTime.Now
            };
            await _repository.AddPhaseAsync(phase);
            return PhaseDto(phase);
        }

        public async Task<ProjectPhaseDto?> UpdatePhaseAsync(int phaseId, UpdatePhaseDto dto)
        {
            var phase = await _repository.GetPhaseByIdAsync(phaseId);
            if (phase == null) return null;

            // Pending, In Progress or Completed only; anything else keeps the current status
            phase.Status = PhaseStatuses.FirstOrDefault(s => s.Equals(dto.Status?.Trim(), StringComparison.OrdinalIgnoreCase)) ?? phase.Status;
            phase.Progress = Math.Clamp(dto.Progress, 0, 100);
            phase.UpdatedAt = AppTime.Now;

            await _repository.UpdatePhaseAsync(phase);
            return PhaseDto(phase);
        }

        public async Task<PhaseSummary?> DescribePhaseAsync(int phaseId)
        {
            var phase = await _repository.GetPhaseByIdAsync(phaseId);
            if (phase == null) return null;
            var project = await _repository.GetByIdAsync(phase.ProjectID);
            return new PhaseSummary(phase.ProjectID, project?.Title ?? "a project", phase.Name, phase.Progress, phase.Status);
        }

        public async Task<bool> DeletePhaseAsync(int phaseId)
        {
            return await _repository.DeletePhaseAsync(phaseId);
        }

        // Expenses, stock issues, invoice lines and requests filed under a phase keep it in place.
        public async Task<string?> GetPhaseDeleteBlockerAsync(int phaseId)
        {
            return await _repository.PhaseInUseAsync(phaseId)
                ? "This phase has expenses, stock issues, invoice lines or material requests filed under it, so it can't be deleted. Rename it instead."
                : null;
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

        // Just the phases, in order (without the money and team work of the full detail).
        public async Task<List<ProjectPhaseDto>> GetPhaseListAsync(int projectId)
        {
            return (await _repository.GetPhasesAsync(projectId)).Select(PhaseDto).ToList();
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
