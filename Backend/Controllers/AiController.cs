using System.Security.Claims;
using System.Text.Json;
using Backend.Ai;
using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Backend.Repositories;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Backend.Controllers
{
    // AI endpoints.
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly IAiClient _ai;
        private readonly AiOptions _options;
        private readonly IWebHostEnvironment _env;
        private readonly IInquiryService _inquiries;
        private readonly INotificationService _notifications;
        private readonly IProjectService _projects;
        private readonly IMaterialService _materials;
        private readonly IAttendanceService _attendance;
        private readonly IBillingService _billing;
        private readonly ISalaryService _salaries;
        private readonly IClientService _clients;
        private readonly IEmployeeService _employees;
        private readonly IAssignmentService _assignments;
        private readonly IPendingActionService _approvals;
        private readonly IMaterialRequestService _matRequests;
        private readonly IPermissionService _permissions;
        private readonly IAiConversationRepository _conversations;

        // Set by a draft_ tool when the assistant prepares an action for the user to confirm.
        // Lives for one request (the controller is scoped), and is returned with the reply.
        private AiProposedAction? _proposed;

        public AiController(IAiClient ai, IOptions<AiOptions> options, IWebHostEnvironment env,
            IInquiryService inquiries, INotificationService notifications,
            IProjectService projects, IMaterialService materials, IAttendanceService attendance,
            IBillingService billing, ISalaryService salaries, IClientService clients, IEmployeeService employees,
            IAssignmentService assignments, IPendingActionService approvals, IMaterialRequestService matRequests,
            IPermissionService permissions, IAiConversationRepository conversations)
        {
            _ai = ai;
            _options = options.Value;
            _env = env;
            _inquiries = inquiries;
            _notifications = notifications;
            _projects = projects;
            _materials = materials;
            _attendance = attendance;
            _billing = billing;
            _salaries = salaries;
            _clients = clients;
            _employees = employees;
            _assignments = assignments;
            _approvals = approvals;
            _matRequests = matRequests;
            _permissions = permissions;
            _conversations = conversations;
        }

        // GET: /api/ai/ping  = check the AI link works (Admin only).
        [HttpGet("ping")]
        [Authorize]
        [AdminOnly]
        public async Task<IActionResult> Ping(CancellationToken ct)
        {
            var reply = await _ai.ChatAsync(
                "You are a connection test for a construction management app. Reply in one short, friendly sentence.",
                Array.Empty<AiMessage>(), "Say hello and confirm the connection is working.",
                Array.Empty<AiTool>(), ct);

            if (!reply.Ok)
                return StatusCode(502, new { message = reply.Error });

            return Ok(new { provider = _ai.Provider, model = _ai.Model, reply = reply.Text });
        }

        // POST: /api/ai/chat  = the public website assistant (no sign-in needed).
        [HttpPost("chat")]
        [AllowAnonymous]
        [UseMainDatabase]
        [EnableRateLimiting(SecurityOptions.AiPublicRateLimitPolicy)]
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto dto, CancellationToken ct)
        {
            if (!_options.Enabled)
                return Ok(new { reply = "The assistant is turned off right now. Please use the contact form and our team will reply within 24 hours." });

            var message = (dto.Message ?? "").Trim();
            if (message.Length == 0)
                return BadRequest(new { message = "Please type a message." });

            var history = BuildHistory(dto);
            var reply = await _ai.ChatAsync(PublicAssistant.SystemPrompt, history, message, PublicTools(), ct);
            return ReplyOrBusy(reply);
        }

        // POST: /api/ai/assistant  = the ERP assistant (signed in, needs the AI Assistant permission).
        // It only gets the read-only tools the user is allowed to use, so it can never show more
        // than that user may already see in the app.
        [HttpPost("assistant")]
        [Authorize]
        [RequirePermission("AI", "View")]
        [EnableRateLimiting(SecurityOptions.AiPublicRateLimitPolicy)]
        public async Task<IActionResult> Assistant([FromBody] AiChatRequestDto dto, CancellationToken ct)
        {
            if (!_options.Enabled)
                return Ok(new { reply = "The assistant is turned off right now." });

            var message = (dto.Message ?? "").Trim();
            if (message.Length == 0)
                return BadRequest(new { message = "Please type a message." });

            var tools = await BuildErpToolsAsync();
            var history = BuildHistory(dto);
            var reply = await _ai.ChatAsync(ErpAssistant.SystemPrompt, history, message, tools, ct);
            return ReplyOrBusy(reply);
        }

        // Saved conversations (the ERP assistant's history). Each belongs to the signed-in user.

        // GET: /api/ai/conversations  = my chat history (newest first).
        [HttpGet("conversations")]
        [Authorize]
        [RequirePermission("AI", "View")]
        public async Task<IActionResult> ListConversations()
        {
            var list = await _conversations.GetForUserAsync(CurrentUserId());
            return Ok(list.Select(c => new AiConversationSummaryDto { Id = c.AiConversationID, Title = c.Title, UpdatedAt = c.UpdatedAt }));
        }

        // GET: /api/ai/conversations/5  = one of my conversations with its messages.
        [HttpGet("conversations/{id:int}")]
        [Authorize]
        [RequirePermission("AI", "View")]
        public async Task<IActionResult> GetConversation(int id)
        {
            var c = await _conversations.GetByIdAsync(id, CurrentUserId());
            if (c == null) return NotFound(new { message = "Conversation not found." });
            return Ok(new AiConversationDetailDto { Id = c.AiConversationID, Title = c.Title, Messages = DeserializeMessages(c.MessagesJson) });
        }

        // POST: /api/ai/conversations  = save a new conversation, returns its id.
        [HttpPost("conversations")]
        [Authorize]
        [RequirePermission("AI", "View")]
        public async Task<IActionResult> CreateConversation([FromBody] SaveAiConversationDto dto)
        {
            var conv = new Backend.Models.Entities.AiConversation
            {
                UserID = CurrentUserId(),
                Title = TitleOf(dto),
                MessagesJson = SerializeMessages(dto.Messages),
                CreatedAt = AppTime.Now,
                UpdatedAt = AppTime.Now
            };
            await _conversations.AddAsync(conv);
            return Ok(new { id = conv.AiConversationID });
        }

        // PUT: /api/ai/conversations/5  = update one of my conversations (new messages / title).
        [HttpPut("conversations/{id:int}")]
        [Authorize]
        [RequirePermission("AI", "View")]
        public async Task<IActionResult> UpdateConversation(int id, [FromBody] SaveAiConversationDto dto)
        {
            var c = await _conversations.GetByIdAsync(id, CurrentUserId());
            if (c == null) return NotFound(new { message = "Conversation not found." });
            c.Title = TitleOf(dto);
            c.MessagesJson = SerializeMessages(dto.Messages);
            c.UpdatedAt = AppTime.Now;
            await _conversations.UpdateAsync(c);
            return Ok(new { id = c.AiConversationID });
        }

        // DELETE: /api/ai/conversations/5  = delete one of my conversations.
        [HttpDelete("conversations/{id:int}")]
        [Authorize]
        [RequirePermission("AI", "View")]
        public async Task<IActionResult> DeleteConversation(int id)
        {
            var ok = await _conversations.DeleteAsync(id, CurrentUserId());
            return ok ? Ok(new { deleted = true }) : NotFound(new { message = "Conversation not found." });
        }

        private int CurrentUserId() =>
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

        private static string TitleOf(SaveAiConversationDto dto)
        {
            var t = (dto.Title ?? "").Trim();
            if (t.Length == 0)
                t = (dto.Messages.FirstOrDefault(m => m.Role == "user")?.Text ?? "").Trim();
            if (t.Length > 120) t = t[..120];
            return t.Length == 0 ? "New chat" : t;
        }

        private static string SerializeMessages(List<AiChatTurnDto> messages) =>
            JsonSerializer.Serialize(messages.TakeLast(200)
                .Select(m => new AiChatTurnDto { Role = m.Role, Text = m.Text ?? "" }));

        private static List<AiChatTurnDto> DeserializeMessages(string json)
        {
            try { return JsonSerializer.Deserialize<List<AiChatTurnDto>>(json) ?? new(); }
            catch { return new(); }
        }

        // Shared helpers

        private List<AiMessage> BuildHistory(AiChatRequestDto dto) =>
            (dto.History ?? new List<AiChatTurnDto>())
                .TakeLast(10)
                .Select(t => new AiMessage(t.Role == "model" ? "model" : "user", (t.Text ?? "").Trim()))
                .Where(t => t.Text.Length > 0)
                .ToList();

        private IActionResult ReplyOrBusy(AiReply reply)
        {
            if (reply.Ok) return Ok(new { reply = reply.Text, action = _proposed });
            var detail = _env.IsDevelopment() && !string.IsNullOrEmpty(reply.Error) ? $" [{reply.Error}]" : "";
            return StatusCode(502, new { message = "The assistant is busy right now. Please try again in a moment." + detail });
        }

        // The public assistant's tools (estimate + inquiry).
        private AiTool[] PublicTools() => new[]
        {
            new AiTool(
                "estimate_cost",
                "Give a rough construction cost estimate for a building. Use this whenever the visitor asks what something would cost to build.",
                new
                {
                    type = "object",
                    properties = new
                    {
                        area_marla = new { type = "number", description = "Plot size in marla" },
                        storeys = new { type = "integer", description = "Number of storeys / floors, eg 1, 2 or 3" },
                        finish = new { type = "string", @enum = new[] { "grey", "standard", "luxury" }, description = "Finish level" }
                    },
                    required = new[] { "area_marla" }
                },
                (args, _) => Task.FromResult<object>(CostEstimator.Estimate(
                    Num(args, "area_marla", 5), (int)Num(args, "storeys", 1), Str(args, "finish", "standard")))),

            new AiTool(
                "create_inquiry",
                "Save the visitor's message so the team can reply. Only call this after the visitor has given their name and phone number and confirmed they want to be contacted.",
                new
                {
                    type = "object",
                    properties = new
                    {
                        name = new { type = "string", description = "Visitor's name" },
                        phone = new { type = "string", description = "Visitor's phone number" },
                        email = new { type = "string", description = "Visitor's email, if given" },
                        service = new { type = "string", description = "Service they are interested in, if clear" },
                        message = new { type = "string", description = "Their message or requirement" }
                    },
                    required = new[] { "name", "phone", "message" }
                },
                CreateInquiryAsync)
        };

        // The ERP assistant's tools: only the read-only ones the signed-in user may use. One tool
        // per area of the system, so the assistant can answer about the whole company, but never
        // beyond that user's own access.
        private async Task<List<AiTool>> BuildErpToolsAsync()
        {
            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
            var isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId);

            async Task<bool> Can(string module) =>
                isAdmin || await _permissions.HasPermissionAsync(userId, module, "View");
            async Task<bool> CanDo(string module, string action) =>
                isAdmin || await _permissions.HasPermissionAsync(userId, module, action);

            var canMoney = isAdmin || await MoneyAccess.CanSeeAsync(User, _permissions, MoneyAccess.ProjectMoney);
            var canWages = isAdmin || await MoneyAccess.CanSeeAsync(User, _permissions, MoneyAccess.Wages);
            var canClientAdd = await CanDo("Clients", "Add");
            var canClientEdit = await CanDo("Clients", "Edit");
            var canClientDelete = await CanDo("Clients", "Delete");
            var canEmpAdd = await CanDo("Employees", "Add");
            var canEmpEdit = await CanDo("Employees", "Edit");
            var canEmpDelete = await CanDo("Employees", "Delete");
            var canMatAdd = await CanDo("Materials", "Add");
            var canMatEdit = await CanDo("Materials", "Edit");
            var canMatDelete = await CanDo("Materials", "Delete");
            var canAssignAdd = await CanDo("Assignments", "Add");
            var canAssignEdit = await CanDo("Assignments", "Edit");
            var canAssignDelete = await CanDo("Assignments", "Delete");
            var canProjAdd = await CanDo("Projects", "Add");
            var canProjEdit = await CanDo("Projects", "Edit");
            var canProjDelete = await CanDo("Projects", "Delete");
            var canApprovalsManage = await CanDo("Approvals", "Manage");
            var noArgs = new { type = "object", properties = new { } };
            var tools = new List<AiTool>();

            // Projects
            if (await Can("Projects"))
            {
                tools.Add(new AiTool("list_projects",
                    "List the company's projects with status and progress. For project questions and how complete they are.",
                    noArgs,
                    async (_, __) =>
                    {
                        var projects = await _projects.GetAllProjectsAsync();
                        return new
                        {
                            projects = projects.Select(p => new
                            {
                                title = p.Title, type = p.ProjectType, status = p.Status,
                                progress_percent = p.OverallProgress, location = p.Location, client = p.ClientName,
                                budget = canMoney ? (decimal?)p.Budget : null
                            })
                        };
                    }));

                tools.Add(new AiTool("get_project_detail",
                    "Detailed status of one project by name: progress, phases, and (if allowed) its cost and profit.",
                    new { type = "object", properties = new { project_name = new { type = "string", description = "Project title or part of it" } }, required = new[] { "project_name" } },
                    async (args, __) =>
                    {
                        var name = Str(args, "project_name", "");
                        var all = await _projects.GetAllProjectsAsync();
                        var match = all.FirstOrDefault(p => p.Title.Contains(name, StringComparison.OrdinalIgnoreCase));
                        if (match == null) return new { found = false, message = "No project matches that name." };
                        var d = await _projects.GetProjectDetailAsync(match.ProjectID);
                        if (d == null) return new { found = false, message = "No project matches that name." };
                        var f = d.Financials;
                        return new
                        {
                            found = true, title = d.Title, status = d.Status, progress_percent = d.OverallProgress,
                            type = d.ProjectType, location = d.Location, client = d.ClientName,
                            phases = d.Phases.Select(ph => new { ph.Name, ph.Status, percent = ph.Progress }),
                            financials = canMoney ? new
                            {
                                budget = f.Budget, material_cost = f.MaterialCost, labour_cost = f.LabourCost,
                                expense_cost = f.ExpenseCost, actual_cost = f.ActualCost, profit = f.Profit, margin_percent = f.MarginPercent
                            } : null
                        };
                    }));

                tools.Add(new AiTool("find_project",
                    "Find projects by title, client or location. Use this to get a project's id before editing or deleting it, or before assigning a worker or adding an expense to it.",
                    new { type = "object", properties = new { query = new { type = "string", description = "Project title, client or location (or part of it)" } }, required = new[] { "query" } },
                    async (args, __) =>
                    {
                        var q = Str(args, "query", "").Trim();
                        var allp = await _projects.GetAllProjectsAsync();
                        var matches = allp.Where(p =>
                                p.Title.Contains(q, StringComparison.OrdinalIgnoreCase)
                                || (p.ClientName ?? "").Contains(q, StringComparison.OrdinalIgnoreCase)
                                || (p.Location ?? "").Contains(q, StringComparison.OrdinalIgnoreCase))
                            .Take(8)
                            .Select(p => new { id = p.ProjectID, title = p.Title, client = p.ClientName, type = p.ProjectType, status = p.Status, location = p.Location })
                            .ToList();
                        return new { count = matches.Count, projects = matches };
                    }));
            }

            // Project actions (prepared for the user to confirm; the real endpoint still checks permission)
            if (canProjAdd)
            {
                tools.Add(new AiTool("draft_add_project",
                    "Prepare a NEW project for the user to confirm. Needs a client (use find_client for client_id), title, project type, area size, location and budget. Never say it is created, the user must confirm.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            title = new { type = "string" },
                            client_id = new { type = "integer", description = "The client's id, from find_client" },
                            project_type = new { type = "string", description = "eg Residential, Commercial, Renovation" },
                            area_size = new { type = "string", description = "eg 5 Marla, 1 Kanal, 2400 sqft" },
                            location = new { type = "string" },
                            budget = new { type = "number", description = "Budget in Rupees" },
                            description = new { type = "string" },
                            start_date = new { type = "string", description = "YYYY-MM-DD" },
                            expected_end_date = new { type = "string", description = "YYYY-MM-DD" },
                            create_standard_phases = new { type = "boolean", description = "Create the standard construction phases, usually yes" }
                        },
                        required = new[] { "title", "client_id", "project_type", "area_size", "location", "budget" }
                    },
                    async (args, __) =>
                    {
                        var clientId = (int)Num(args, "client_id", 0);
                        var clients = await _clients.GetAllClientsAsync();
                        var cl = clients.FirstOrDefault(c => c.ClientID == clientId);
                        if (cl == null)
                            return new { prepared = false, message = "I need a valid client for the project. Use find_client to get the client id first." };

                        var dto = new CreateProjectDto
                        {
                            Title = Str(args, "title", "").Trim(),
                            ClientID = clientId,
                            ProjectType = Str(args, "project_type", "").Trim(),
                            AreaSize = Str(args, "area_size", "").Trim(),
                            Location = Str(args, "location", "").Trim(),
                            Description = StrOrNull(args, "description"),
                            StartDate = ParseDate(StrOrNull(args, "start_date")),
                            ExpectedEndDate = ParseDate(StrOrNull(args, "expected_end_date")),
                            Budget = (decimal)Num(args, "budget", 0),
                            CreateStandardPhases = GetBool(args, "create_standard_phases", true)
                        };
                        if (dto.Title.Length == 0 || dto.ProjectType.Length == 0 || dto.AreaSize.Length == 0 || dto.Location.Length == 0)
                            return new { prepared = false, message = "I still need the title, project type, area size and location." };

                        var fields = new List<AiActionField>
                        {
                            new() { Label = "Title", Value = dto.Title },
                            new() { Label = "Client", Value = cl.FullName },
                            new() { Label = "Type", Value = dto.ProjectType },
                            new() { Label = "Area", Value = dto.AreaSize },
                            new() { Label = "Location", Value = dto.Location },
                            new() { Label = "Budget", Value = $"Rs {dto.Budget:N0}" }
                        };
                        if (dto.StartDate.HasValue) fields.Add(new() { Label = "Start date", Value = dto.StartDate.Value.ToString("yyyy-MM-dd") });
                        if (dto.ExpectedEndDate.HasValue) fields.Add(new() { Label = "Expected end", Value = dto.ExpectedEndDate.Value.ToString("yyyy-MM-dd") });
                        fields.Add(new() { Label = "Standard phases", Value = dto.CreateStandardPhases ? "Yes" : "No" });

                        _proposed = new AiProposedAction
                        {
                            Kind = "add_project", Title = "Add project", Summary = $"Create project: {dto.Title} for {cl.FullName}.",
                            Method = "POST", Url = "/projects", Payload = dto, ConfirmLabel = "Create project", Fields = fields
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            if (canProjDelete)
            {
                tools.Add(new AiTool("draft_delete_project",
                    "Prepare the DELETE of a project for the user to confirm. Pass project_id (use find_project first). Never say it is deleted, the user must confirm. A project with billing or other data may be blocked.",
                    new { type = "object", properties = new { project_id = new { type = "integer", description = "The project's id, from find_project" } }, required = new[] { "project_id" } },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "project_id", 0);
                        var allp = await _projects.GetAllProjectsAsync();
                        var p = allp.FirstOrDefault(x => x.ProjectID == id);
                        if (p == null)
                            return new { prepared = false, message = "I couldn't find that project. Use find_project to get the right one." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "delete_project", Title = "Delete project", Summary = $"Delete {p.Title}.",
                            Method = "DELETE", Url = $"/projects/{id}", Payload = null, ConfirmLabel = "Delete", Danger = true,
                            Note = "This can't be undone. A project with invoices, assignments or other records may not be deletable.",
                            Fields = new()
                            {
                                new() { Label = "Title", Value = p.Title },
                                new() { Label = "Client", Value = p.ClientName },
                                new() { Label = "Location", Value = string.IsNullOrWhiteSpace(p.Location) ? "-" : p.Location }
                            }
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            // Materials
            if (await Can("Materials"))
            {
                tools.Add(new AiTool("low_stock_materials",
                    "List materials that are low or out of stock. For what needs reordering.",
                    noArgs,
                    async (_, __) =>
                    {
                        var materials = await _materials.GetAllMaterialsAsync();
                        var low = materials.Where(m => m.Status == "Active" && m.CurrentStock <= m.LowStockThreshold)
                            .Select(m => new { name = m.Name, unit = m.Unit, current_stock = m.CurrentStock, low_stock_threshold = m.LowStockThreshold, out_of_stock = m.CurrentStock <= 0, stock_value = canMoney ? (decimal?)m.StockValue : null })
                            .ToList();
                        return new { count = low.Count, materials = low };
                    }));

                tools.Add(new AiTool("find_material",
                    "Current stock of one material by name.",
                    new { type = "object", properties = new { material_name = new { type = "string", description = "Material name or part of it" } }, required = new[] { "material_name" } },
                    async (args, __) =>
                    {
                        var name = Str(args, "material_name", "");
                        var materials = await _materials.GetAllMaterialsAsync();
                        var found = materials.Where(m => m.Name.Contains(name, StringComparison.OrdinalIgnoreCase))
                            .Select(m => new { id = m.MaterialID, name = m.Name, category = m.Category, unit = m.Unit, current_stock = m.CurrentStock, low_stock_threshold = m.LowStockThreshold, status = m.Status, stock_value = canMoney ? (decimal?)m.StockValue : null })
                            .ToList();
                        return new { count = found.Count, materials = found };
                    }));
            }

            // Material actions (prepared for the user to confirm; the real endpoint still checks permission)
            if (canMatAdd)
            {
                tools.Add(new AiTool("draft_add_material",
                    "Prepare a NEW material for the user to confirm. name, category and unit are required. Never say it is added, the user must confirm.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            name = new { type = "string", description = "Material name, eg Cement (OPC)" },
                            category = new { type = "string", description = "eg Cement, Steel, Bricks, Sand" },
                            unit = new { type = "string", description = "Unit of measure, eg Bag, Kg, Ton, Cft" },
                            low_stock_threshold = new { type = "integer", description = "Alert when stock falls to this, default 0" },
                            initial_stock = new { type = "number", description = "Opening stock quantity, optional" },
                            initial_rate = new { type = "number", description = "Rate per unit for the opening stock, optional" }
                        },
                        required = new[] { "name", "category", "unit" }
                    },
                    (args, __) =>
                    {
                        var dto = new CreateMaterialDto
                        {
                            Name = Str(args, "name", "").Trim(),
                            Category = Str(args, "category", "").Trim(),
                            Unit = Str(args, "unit", "").Trim(),
                            LowStockThreshold = (int)Num(args, "low_stock_threshold", 0),
                            Status = "Active",
                            InitialStock = HasNum(args, "initial_stock") ? (decimal)Num(args, "initial_stock", 0) : null,
                            InitialRate = HasNum(args, "initial_rate") ? (decimal)Num(args, "initial_rate", 0) : null
                        };
                        if (dto.Name.Length == 0 || dto.Category.Length == 0 || dto.Unit.Length == 0)
                            return Task.FromResult<object>(new { prepared = false, message = "I still need the name, category and unit." });

                        var fields = new List<AiActionField>
                        {
                            new() { Label = "Name", Value = dto.Name },
                            new() { Label = "Category", Value = dto.Category },
                            new() { Label = "Unit", Value = dto.Unit },
                            new() { Label = "Low-stock alert", Value = dto.LowStockThreshold.ToString() }
                        };
                        if (dto.InitialStock.HasValue) fields.Add(new() { Label = "Opening stock", Value = $"{dto.InitialStock} {dto.Unit}" });
                        if (dto.InitialRate.HasValue) fields.Add(new() { Label = "Opening rate", Value = $"Rs {dto.InitialRate}/{dto.Unit}" });

                        _proposed = new AiProposedAction
                        {
                            Kind = "add_material", Title = "Add material", Summary = $"Add material: {dto.Name}.",
                            Method = "POST", Url = "/materials", Payload = dto, ConfirmLabel = "Add material", Fields = fields
                        };
                        return Task.FromResult<object>(new { prepared = true, summary = _proposed.Summary });
                    }));
            }

            if (canMatEdit)
            {
                tools.Add(new AiTool("draft_edit_material",
                    "Prepare an UPDATE to a material for the user to confirm. Pass material_id (use find_material first) and only the fields that change. Never say it is saved, the user must confirm.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            material_id = new { type = "integer", description = "The material's id, from find_material" },
                            name = new { type = "string" },
                            category = new { type = "string" },
                            unit = new { type = "string" },
                            low_stock_threshold = new { type = "integer" },
                            status = new { type = "string", @enum = new[] { "Active", "Inactive" } }
                        },
                        required = new[] { "material_id" }
                    },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "material_id", 0);
                        var all = await _materials.GetAllMaterialsAsync();
                        var m = all.FirstOrDefault(x => x.MaterialID == id);
                        if (m == null)
                            return new { prepared = false, message = "I couldn't find that material. Use find_material to get the right one." };

                        var changes = new List<AiActionField>();
                        string Pick(string arg, string current, string label)
                        {
                            var provided = args.ValueKind == JsonValueKind.Object && args.TryGetProperty(arg, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                            var next = provided ?? current;
                            if (!string.Equals(next ?? "", current ?? "", StringComparison.Ordinal))
                                changes.Add(new AiActionField { Label = label, From = string.IsNullOrWhiteSpace(current) ? "-" : current, To = string.IsNullOrWhiteSpace(next) ? "-" : next, Changed = true });
                            return next ?? "";
                        }
                        var currentThreshold = m.LowStockThreshold;
                        var nextThreshold = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("low_stock_threshold", out var tv) && tv.ValueKind == JsonValueKind.Number ? tv.GetInt32() : currentThreshold;
                        if (nextThreshold != currentThreshold)
                            changes.Add(new AiActionField { Label = "Low-stock alert", From = currentThreshold.ToString(), To = nextThreshold.ToString(), Changed = true });

                        var dto = new CreateMaterialDto
                        {
                            Name = Pick("name", m.Name, "Name"),
                            Category = Pick("category", m.Category, "Category"),
                            Unit = Pick("unit", m.Unit, "Unit"),
                            LowStockThreshold = nextThreshold,
                            Status = Pick("status", m.Status, "Status"),
                            InitialStock = null,
                            InitialRate = null
                        };
                        if (changes.Count == 0)
                            return new { prepared = false, message = "Nothing would change for that material." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "edit_material", Title = "Update material", Summary = $"Update {m.Name}.",
                            Method = "PUT", Url = $"/materials/{id}", Payload = dto, ConfirmLabel = "Save changes", Fields = changes
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            if (canMatDelete)
            {
                tools.Add(new AiTool("draft_delete_material",
                    "Prepare the DELETE of a material for the user to confirm. Pass material_id (use find_material first). Never say it is deleted, the user must confirm. A material with stock history may be blocked.",
                    new { type = "object", properties = new { material_id = new { type = "integer", description = "The material's id, from find_material" } }, required = new[] { "material_id" } },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "material_id", 0);
                        var all = await _materials.GetAllMaterialsAsync();
                        var m = all.FirstOrDefault(x => x.MaterialID == id);
                        if (m == null)
                            return new { prepared = false, message = "I couldn't find that material. Use find_material to get the right one." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "delete_material", Title = "Delete material", Summary = $"Delete {m.Name}.",
                            Method = "DELETE", Url = $"/materials/{id}", Payload = null, ConfirmLabel = "Delete", Danger = true,
                            Note = "This can't be undone. A material with stock or transaction history may not be deletable.",
                            Fields = new()
                            {
                                new() { Label = "Name", Value = m.Name },
                                new() { Label = "Category", Value = m.Category },
                                new() { Label = "Current stock", Value = $"{m.CurrentStock} {m.Unit}" }
                            }
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            // Attendance
            if (await Can("Attendance"))
            {
                tools.Add(new AiTool("attendance_today",
                    "Today's attendance for each active project: present, absent and unmarked worker counts.",
                    noArgs,
                    async (_, ct) =>
                    {
                        var today = AppTime.Now.Date;
                        var cards = await _attendance.GetProjectCardsAsync();
                        var result = new List<object>();
                        foreach (var card in cards.Where(c => c.Status == "In Progress"))
                        {
                            var sheet = await _attendance.GetSheetAsync(card.ProjectID, today);
                            if (sheet == null) continue;
                            result.Add(new { project = card.Title, present = sheet.PresentCount, absent = sheet.AbsentCount, unmarked = sheet.UnmarkedCount });
                        }
                        return new { date = today.ToString("yyyy-MM-dd"), projects = result };
                    }));
            }

            // Billing
            if (await Can("Billing"))
            {
                tools.Add(new AiTool("billing_overview",
                    "Billing summary: invoiced, received, outstanding, overdue, and per project what is still owed.",
                    noArgs,
                    async (_, __) =>
                    {
                        var o = await _billing.GetOverviewAsync();
                        return new
                        {
                            total_invoices = o.TotalInvoices, paid_count = o.PaidCount, unpaid_count = o.UnpaidCount, overdue_count = o.OverdueCount,
                            received = o.PaidAmount, outstanding = o.UnpaidAmount, overdue_amount = o.OverdueAmount,
                            projects = o.Projects.Select(p => new { project = p.Title, client = p.ClientName, billed = p.Billed, received = p.Received, outstanding = p.Outstanding, overdue_count = p.OverdueCount })
                        };
                    }));
            }

            // Salaries (payroll)
            if (await Can("Salaries"))
            {
                tools.Add(new AiTool("salaries_summary",
                    "This month's payroll: total payroll, paid, pending, and which workers are still unpaid.",
                    noArgs,
                    async (_, __) =>
                    {
                        var now = AppTime.Now;
                        var period = await _salaries.GetPeriodAsync(now.Year, now.Month, null);
                        return new
                        {
                            month = $"{now:yyyy-MM}",
                            total_payroll = period.TotalPayroll, paid = period.Paid, pending = period.Pending, workers = period.WorkersCount,
                            not_fully_paid = period.Employees.Where(e => e.Status != "Paid")
                                .Select(e => new { name = e.EmployeeName, designation = e.Designation, status = e.Status, amount = e.Total })
                        };
                    }));
            }

            // Clients
            if (await Can("Clients"))
            {
                tools.Add(new AiTool("list_clients",
                    "The company's clients, with phone and city.",
                    noArgs,
                    async (_, __) =>
                    {
                        var clients = await _clients.GetAllClientsAsync();
                        var list = clients.Take(100).Select(c => new { name = c.FullName, phone = c.Phone, city = c.City, type = c.ClientType, status = c.Status }).ToList();
                        return new { count = list.Count, clients = list };
                    }));

                tools.Add(new AiTool("find_client",
                    "Find clients by name, phone or CNIC. Use this to get a client's id and current details before editing or deleting one.",
                    new { type = "object", properties = new { query = new { type = "string", description = "Name, phone or CNIC (or part of it)" } }, required = new[] { "query" } },
                    async (args, __) =>
                    {
                        var q = Str(args, "query", "").Trim();
                        var all = await _clients.GetAllClientsAsync();
                        var matches = all.Where(c =>
                                c.FullName.Contains(q, StringComparison.OrdinalIgnoreCase)
                                || (c.Phone ?? "").Contains(q)
                                || (c.CNIC ?? "").Contains(q))
                            .Take(8)
                            .Select(c => new { id = c.ClientID, name = c.FullName, phone = c.Phone, cnic = c.CNIC, email = c.Email, city = c.City, type = c.ClientType, status = c.Status })
                            .ToList();
                        return new { count = matches.Count, clients = matches };
                    }));
            }

            // Client actions (prepared for the user to confirm; the real endpoint still checks permission)
            if (canClientAdd)
            {
                tools.Add(new AiTool("draft_add_client",
                    "Prepare a NEW client for the user to confirm. Call this when the user wants to add a client. full_name, phone and cnic are required. Never say the client is added, the user must confirm the card first.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            full_name = new { type = "string", description = "Client's full name" },
                            phone = new { type = "string", description = "Phone, Pakistani format eg 0300-1234567" },
                            cnic = new { type = "string", description = "13-digit CNIC eg 35202-1234567-1" },
                            email = new { type = "string" },
                            secondary_phone = new { type = "string" },
                            address = new { type = "string" },
                            city = new { type = "string" },
                            client_type = new { type = "string", @enum = new[] { "External", "Internal" }, description = "External (a paying customer) or Internal. Ask the user, usually External." }
                        },
                        required = new[] { "full_name", "phone", "cnic", "client_type" }
                    },
                    (args, __) =>
                    {
                        var dto = new ClientDto
                        {
                            FullName = Str(args, "full_name", "").Trim(),
                            Phone = Str(args, "phone", "").Trim(),
                            CNIC = Str(args, "cnic", "").Trim(),
                            Email = StrOrNull(args, "email"),
                            SecondaryPhone = StrOrNull(args, "secondary_phone"),
                            Address = StrOrNull(args, "address"),
                            City = StrOrNull(args, "city"),
                            ClientType = Str(args, "client_type", "External"),
                            Status = "Active"
                        };
                        if (dto.FullName.Length == 0 || dto.Phone.Length == 0 || dto.CNIC.Length == 0)
                            return Task.FromResult<object>(new { prepared = false, message = "I still need the full name, phone and CNIC." });

                        var fields = new List<AiActionField>
                        {
                            new() { Label = "Name", Value = dto.FullName },
                            new() { Label = "Phone", Value = dto.Phone },
                            new() { Label = "CNIC", Value = dto.CNIC }
                        };
                        if (!string.IsNullOrWhiteSpace(dto.Email)) fields.Add(new() { Label = "Email", Value = dto.Email });
                        if (!string.IsNullOrWhiteSpace(dto.SecondaryPhone)) fields.Add(new() { Label = "Secondary phone", Value = dto.SecondaryPhone });
                        if (!string.IsNullOrWhiteSpace(dto.Address)) fields.Add(new() { Label = "Address", Value = dto.Address });
                        if (!string.IsNullOrWhiteSpace(dto.City)) fields.Add(new() { Label = "City", Value = dto.City });
                        fields.Add(new() { Label = "Type", Value = dto.ClientType });

                        _proposed = new AiProposedAction
                        {
                            Kind = "add_client", Title = "Add client", Summary = $"Create a new client: {dto.FullName}.",
                            Method = "POST", Url = "/clients", Payload = dto, ConfirmLabel = "Add client", Fields = fields
                        };
                        return Task.FromResult<object>(new { prepared = true, summary = _proposed.Summary });
                    }));
            }

            if (canClientEdit)
            {
                tools.Add(new AiTool("draft_edit_client",
                    "Prepare an UPDATE to an existing client for the user to confirm. Pass client_id (use find_client first) and only the fields that change. Never say it is saved, the user must confirm.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            client_id = new { type = "integer", description = "The client's id, from find_client" },
                            full_name = new { type = "string" },
                            phone = new { type = "string" },
                            cnic = new { type = "string" },
                            email = new { type = "string" },
                            secondary_phone = new { type = "string" },
                            address = new { type = "string" },
                            city = new { type = "string" },
                            client_type = new { type = "string", @enum = new[] { "External", "Internal" } },
                            status = new { type = "string", @enum = new[] { "Active", "Inactive" } }
                        },
                        required = new[] { "client_id" }
                    },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "client_id", 0);
                        var all = await _clients.GetAllClientsAsync();
                        var c = all.FirstOrDefault(x => x.ClientID == id);
                        if (c == null)
                            return new { prepared = false, message = "I couldn't find that client. Use find_client to get the right one." };

                        var changes = new List<AiActionField>();
                        string Pick(string arg, string current, string label)
                        {
                            var provided = args.ValueKind == JsonValueKind.Object && args.TryGetProperty(arg, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                            var next = provided ?? current;
                            if (!string.Equals(next ?? "", current ?? "", StringComparison.Ordinal))
                                changes.Add(new AiActionField { Label = label, From = string.IsNullOrWhiteSpace(current) ? "-" : current, To = string.IsNullOrWhiteSpace(next) ? "-" : next, Changed = true });
                            return next ?? "";
                        }
                        static string? NullIfEmpty(string s) => string.IsNullOrWhiteSpace(s) ? null : s;

                        var dto = new ClientDto
                        {
                            FullName = Pick("full_name", c.FullName, "Name"),
                            Phone = Pick("phone", c.Phone, "Phone"),
                            CNIC = Pick("cnic", c.CNIC, "CNIC"),
                            Email = NullIfEmpty(Pick("email", c.Email ?? "", "Email")),
                            SecondaryPhone = NullIfEmpty(Pick("secondary_phone", c.SecondaryPhone ?? "", "Secondary phone")),
                            Address = NullIfEmpty(Pick("address", c.Address ?? "", "Address")),
                            City = NullIfEmpty(Pick("city", c.City ?? "", "City")),
                            ClientType = Pick("client_type", c.ClientType, "Type"),
                            Status = Pick("status", c.Status, "Status")
                        };
                        if (changes.Count == 0)
                            return new { prepared = false, message = "Nothing would change for that client." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "edit_client", Title = "Update client", Summary = $"Update {c.FullName}.",
                            Method = "PUT", Url = $"/clients/{id}", Payload = dto, ConfirmLabel = "Save changes", Fields = changes
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            if (canClientDelete)
            {
                tools.Add(new AiTool("draft_delete_client",
                    "Prepare the DELETE of a client for the user to confirm. Pass client_id (use find_client first). Never say it is deleted, the user must confirm. A client with projects cannot be deleted, and non-admins' deletes go to approval.",
                    new { type = "object", properties = new { client_id = new { type = "integer", description = "The client's id, from find_client" } }, required = new[] { "client_id" } },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "client_id", 0);
                        var all = await _clients.GetAllClientsAsync();
                        var c = all.FirstOrDefault(x => x.ClientID == id);
                        if (c == null)
                            return new { prepared = false, message = "I couldn't find that client. Use find_client to get the right one." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "delete_client", Title = "Delete client", Summary = $"Delete {c.FullName}.",
                            Method = "DELETE", Url = $"/clients/{id}", Payload = null, ConfirmLabel = "Delete", Danger = true,
                            Note = "This can't be undone. A client with projects can't be deleted, and if your role needs approval the delete is sent for review.",
                            Fields = new()
                            {
                                new() { Label = "Name", Value = c.FullName },
                                new() { Label = "Phone", Value = c.Phone },
                                new() { Label = "City", Value = string.IsNullOrWhiteSpace(c.City) ? "-" : c.City }
                            }
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            // Employees
            if (await Can("Employees"))
            {
                tools.Add(new AiTool("list_employees",
                    "The company's employees, with designation and status.",
                    noArgs,
                    async (_, __) =>
                    {
                        var employees = await _employees.GetAllEmployeesAsync();
                        var list = employees.Take(200).Select(e => new { name = e.FullName, designation = e.Designation, status = e.Status, phone = e.Phone }).ToList();
                        return new { count = list.Count, employees = list };
                    }));

                tools.Add(new AiTool("find_employee",
                    "Find employees by name, designation, phone or CNIC. Use this to get an employee's id and current details before editing or deleting one.",
                    new { type = "object", properties = new { query = new { type = "string", description = "Name, designation, phone or CNIC (or part of it)" } }, required = new[] { "query" } },
                    async (args, __) =>
                    {
                        var q = Str(args, "query", "").Trim();
                        var all = await _employees.GetAllEmployeesAsync();
                        var matches = all.Where(e =>
                                e.FullName.Contains(q, StringComparison.OrdinalIgnoreCase)
                                || (e.Designation ?? "").Contains(q, StringComparison.OrdinalIgnoreCase)
                                || (e.Phone ?? "").Contains(q)
                                || (e.CNIC ?? "").Contains(q))
                            .Take(8)
                            .Select(e => new { id = e.EmployeeID, name = e.FullName, designation = e.Designation, phone = e.Phone, cnic = e.CNIC, email = e.Email, city = e.City, status = e.Status, joining_date = e.JoiningDate.HasValue ? e.JoiningDate.Value.ToString("yyyy-MM-dd") : null })
                            .ToList();
                        return new { count = matches.Count, employees = matches };
                    }));
            }

            // Employee actions (prepared for the user to confirm; the real endpoint still checks permission)
            if (canEmpAdd)
            {
                tools.Add(new AiTool("draft_add_employee",
                    "Prepare a NEW employee for the user to confirm. full_name, phone and designation are required. Never say the employee is added, the user must confirm the card.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            full_name = new { type = "string", description = "Employee's full name" },
                            phone = new { type = "string", description = "Phone, eg 0300-1234567" },
                            designation = new { type = "string", description = "Role, eg Site Engineer, Mason" },
                            cnic = new { type = "string", description = "13-digit CNIC eg 35202-1234567-1" },
                            email = new { type = "string" },
                            secondary_phone = new { type = "string" },
                            address = new { type = "string" },
                            city = new { type = "string" },
                            joining_date = new { type = "string", description = "Joining date, YYYY-MM-DD" }
                        },
                        required = new[] { "full_name", "phone", "designation" }
                    },
                    (args, __) =>
                    {
                        var jd = ParseDate(StrOrNull(args, "joining_date"));
                        var dto = new CreateEmployeeDto
                        {
                            FullName = Str(args, "full_name", "").Trim(),
                            Phone = Str(args, "phone", "").Trim(),
                            Designation = Str(args, "designation", "").Trim(),
                            CNIC = StrOrNull(args, "cnic"),
                            Email = StrOrNull(args, "email"),
                            SecondaryPhone = StrOrNull(args, "secondary_phone"),
                            Address = StrOrNull(args, "address"),
                            City = StrOrNull(args, "city"),
                            JoiningDate = jd,
                            Status = "Active"
                        };
                        if (dto.FullName.Length == 0 || dto.Phone.Length == 0 || dto.Designation.Length == 0)
                            return Task.FromResult<object>(new { prepared = false, message = "I still need the full name, phone and designation." });

                        var fields = new List<AiActionField>
                        {
                            new() { Label = "Name", Value = dto.FullName },
                            new() { Label = "Phone", Value = dto.Phone },
                            new() { Label = "Designation", Value = dto.Designation }
                        };
                        if (!string.IsNullOrWhiteSpace(dto.CNIC)) fields.Add(new() { Label = "CNIC", Value = dto.CNIC });
                        if (!string.IsNullOrWhiteSpace(dto.Email)) fields.Add(new() { Label = "Email", Value = dto.Email });
                        if (!string.IsNullOrWhiteSpace(dto.SecondaryPhone)) fields.Add(new() { Label = "Secondary phone", Value = dto.SecondaryPhone });
                        if (!string.IsNullOrWhiteSpace(dto.Address)) fields.Add(new() { Label = "Address", Value = dto.Address });
                        if (!string.IsNullOrWhiteSpace(dto.City)) fields.Add(new() { Label = "City", Value = dto.City });
                        if (jd.HasValue) fields.Add(new() { Label = "Joining date", Value = jd.Value.ToString("yyyy-MM-dd") });

                        _proposed = new AiProposedAction
                        {
                            Kind = "add_employee", Title = "Add employee", Summary = $"Create a new employee: {dto.FullName}.",
                            Method = "POST", Url = "/employees", Payload = dto, ConfirmLabel = "Add employee", Fields = fields
                        };
                        return Task.FromResult<object>(new { prepared = true, summary = _proposed.Summary });
                    }));
            }

            if (canEmpEdit)
            {
                tools.Add(new AiTool("draft_edit_employee",
                    "Prepare an UPDATE to an existing employee for the user to confirm. Pass employee_id (use find_employee first) and only the fields that change. Never say it is saved, the user must confirm.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            employee_id = new { type = "integer", description = "The employee's id, from find_employee" },
                            full_name = new { type = "string" },
                            phone = new { type = "string" },
                            designation = new { type = "string" },
                            cnic = new { type = "string" },
                            email = new { type = "string" },
                            secondary_phone = new { type = "string" },
                            address = new { type = "string" },
                            city = new { type = "string" },
                            joining_date = new { type = "string", description = "YYYY-MM-DD" },
                            status = new { type = "string", @enum = new[] { "Active", "Inactive" } }
                        },
                        required = new[] { "employee_id" }
                    },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "employee_id", 0);
                        var all = await _employees.GetAllEmployeesAsync();
                        var e = all.FirstOrDefault(x => x.EmployeeID == id);
                        if (e == null)
                            return new { prepared = false, message = "I couldn't find that employee. Use find_employee to get the right one." };

                        var changes = new List<AiActionField>();
                        string Pick(string arg, string current, string label)
                        {
                            var provided = args.ValueKind == JsonValueKind.Object && args.TryGetProperty(arg, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                            var next = provided ?? current;
                            if (!string.Equals(next ?? "", current ?? "", StringComparison.Ordinal))
                                changes.Add(new AiActionField { Label = label, From = string.IsNullOrWhiteSpace(current) ? "-" : current, To = string.IsNullOrWhiteSpace(next) ? "-" : next, Changed = true });
                            return next ?? "";
                        }
                        static string? NullIfEmpty(string s) => string.IsNullOrWhiteSpace(s) ? null : s;

                        var currentJd = e.JoiningDate.HasValue ? e.JoiningDate.Value.ToString("yyyy-MM-dd") : "";
                        var nextJd = Pick("joining_date", currentJd, "Joining date");
                        var dto = new CreateEmployeeDto
                        {
                            FullName = Pick("full_name", e.FullName, "Name"),
                            Phone = Pick("phone", e.Phone, "Phone"),
                            Designation = Pick("designation", e.Designation, "Designation"),
                            CNIC = NullIfEmpty(Pick("cnic", e.CNIC ?? "", "CNIC")),
                            Email = NullIfEmpty(Pick("email", e.Email ?? "", "Email")),
                            SecondaryPhone = NullIfEmpty(Pick("secondary_phone", e.SecondaryPhone ?? "", "Secondary phone")),
                            Address = NullIfEmpty(Pick("address", e.Address ?? "", "Address")),
                            City = NullIfEmpty(Pick("city", e.City ?? "", "City")),
                            JoiningDate = ParseDate(NullIfEmpty(nextJd)),
                            Status = Pick("status", e.Status, "Status")
                        };
                        if (changes.Count == 0)
                            return new { prepared = false, message = "Nothing would change for that employee." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "edit_employee", Title = "Update employee", Summary = $"Update {e.FullName}.",
                            Method = "PUT", Url = $"/employees/{id}", Payload = dto, ConfirmLabel = "Save changes", Fields = changes
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            if (canEmpDelete)
            {
                tools.Add(new AiTool("draft_delete_employee",
                    "Prepare the DELETE of an employee for the user to confirm. Pass employee_id (use find_employee first). Never say it is deleted, the user must confirm. Non-admins' deletes go to approval.",
                    new { type = "object", properties = new { employee_id = new { type = "integer", description = "The employee's id, from find_employee" } }, required = new[] { "employee_id" } },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "employee_id", 0);
                        var all = await _employees.GetAllEmployeesAsync();
                        var e = all.FirstOrDefault(x => x.EmployeeID == id);
                        if (e == null)
                            return new { prepared = false, message = "I couldn't find that employee. Use find_employee to get the right one." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "delete_employee", Title = "Delete employee", Summary = $"Delete {e.FullName}.",
                            Method = "DELETE", Url = $"/employees/{id}", Payload = null, ConfirmLabel = "Delete", Danger = true,
                            Note = "This can't be undone, and if your role needs approval the delete is sent for review.",
                            Fields = new()
                            {
                                new() { Label = "Name", Value = e.FullName },
                                new() { Label = "Designation", Value = e.Designation },
                                new() { Label = "Phone", Value = e.Phone }
                            }
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            // Assignments (who works where)
            if (await Can("Assignments"))
            {
                tools.Add(new AiTool("assignments_overview",
                    "Current assignments: which worker is on which project and their role.",
                    noArgs,
                    async (_, __) =>
                    {
                        var all = await _assignments.GetAllAsync();
                        var active = all.Where(a => a.Status == "Active")
                            .Select(a => new { id = a.AssignmentID, employee = a.EmployeeName, project = a.ProjectTitle, role = a.Role, wage_type = a.WageType, wage = canWages ? (decimal?)a.WageAmount : null })
                            .ToList();
                        return new { count = active.Count, assignments = active };
                    }));
            }

            // Assignment actions (prepared for the user to confirm; the real endpoint still checks permission)
            if (canAssignAdd)
            {
                tools.Add(new AiTool("draft_add_assignment",
                    "Prepare assigning a worker to a project for the user to confirm. Use find_employee for employee_id and find_project for project_id. Never say it is assigned, the user must confirm.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            employee_id = new { type = "integer", description = "The employee's id, from find_employee" },
                            project_id = new { type = "integer", description = "The project's id, from find_project" },
                            role = new { type = "string", description = "Role on site, eg Mason, Labour, Site Engineer" },
                            wage_type = new { type = "string", @enum = new[] { "Daily", "Monthly", "Contract" } },
                            wage_amount = new { type = "number", description = "Wage in Rupees (per day for Daily, per month for Monthly, total for Contract)" },
                            start_date = new { type = "string", description = "YYYY-MM-DD, defaults to today" },
                            end_date = new { type = "string", description = "YYYY-MM-DD, optional" },
                            notes = new { type = "string" }
                        },
                        required = new[] { "employee_id", "project_id", "role", "wage_type", "wage_amount" }
                    },
                    async (args, __) =>
                    {
                        var empId = (int)Num(args, "employee_id", 0);
                        var projId = (int)Num(args, "project_id", 0);
                        var emps = await _employees.GetAllEmployeesAsync();
                        var e = emps.FirstOrDefault(x => x.EmployeeID == empId);
                        var projs = await _projects.GetAllProjectsAsync();
                        var p = projs.FirstOrDefault(x => x.ProjectID == projId);
                        if (e == null) return new { prepared = false, message = "I need a valid employee. Use find_employee first." };
                        if (p == null) return new { prepared = false, message = "I need a valid project. Use find_project first." };

                        var wageType = Str(args, "wage_type", "Daily").Trim();
                        var wage = (decimal)Num(args, "wage_amount", 0);
                        var start = ParseDate(StrOrNull(args, "start_date")) ?? AppTime.Now.Date;
                        var dto = new CreateAssignmentDto
                        {
                            EmployeeID = empId, ProjectID = projId,
                            Role = Str(args, "role", "").Trim(),
                            WageType = wageType.Length == 0 ? "Daily" : wageType,
                            WageAmount = wage,
                            StartDate = start,
                            EndDate = ParseDate(StrOrNull(args, "end_date")),
                            Status = "Active",
                            Notes = StrOrNull(args, "notes")
                        };
                        if (dto.Role.Length == 0)
                            return new { prepared = false, message = "I still need the worker's role." };

                        var fields = new List<AiActionField>
                        {
                            new() { Label = "Worker", Value = e.FullName },
                            new() { Label = "Project", Value = p.Title },
                            new() { Label = "Role", Value = dto.Role },
                            new() { Label = "Wage", Value = $"{dto.WageType}: Rs {dto.WageAmount:N0}" },
                            new() { Label = "Start date", Value = dto.StartDate.ToString("yyyy-MM-dd") }
                        };
                        if (dto.EndDate.HasValue) fields.Add(new() { Label = "End date", Value = dto.EndDate.Value.ToString("yyyy-MM-dd") });

                        _proposed = new AiProposedAction
                        {
                            Kind = "add_assignment", Title = "Assign worker", Summary = $"Assign {e.FullName} to {p.Title}.",
                            Method = "POST", Url = "/assignments", Payload = dto, ConfirmLabel = "Assign", Fields = fields
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            if (canAssignEdit)
            {
                tools.Add(new AiTool("draft_edit_assignment",
                    "Prepare an UPDATE to an assignment for the user to confirm. Pass assignment_id (use assignments_overview for the id) and only the fields that change. Never say it is saved, the user must confirm.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            assignment_id = new { type = "integer", description = "The assignment's id, from assignments_overview" },
                            role = new { type = "string" },
                            wage_type = new { type = "string", @enum = new[] { "Daily", "Monthly", "Contract" } },
                            wage_amount = new { type = "number" },
                            end_date = new { type = "string", description = "YYYY-MM-DD" },
                            status = new { type = "string", @enum = new[] { "Active", "Ended" } },
                            notes = new { type = "string" }
                        },
                        required = new[] { "assignment_id" }
                    },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "assignment_id", 0);
                        var all = await _assignments.GetAllAsync();
                        var a = all.FirstOrDefault(x => x.AssignmentID == id);
                        if (a == null)
                            return new { prepared = false, message = "I couldn't find that assignment. Use assignments_overview to get the right one." };

                        var changes = new List<AiActionField>();
                        string Pick(string arg, string current, string label)
                        {
                            var provided = args.ValueKind == JsonValueKind.Object && args.TryGetProperty(arg, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                            var next = provided ?? current;
                            if (!string.Equals(next ?? "", current ?? "", StringComparison.Ordinal))
                                changes.Add(new AiActionField { Label = label, From = string.IsNullOrWhiteSpace(current) ? "-" : current, To = string.IsNullOrWhiteSpace(next) ? "-" : next, Changed = true });
                            return next ?? "";
                        }

                        var wage = a.WageAmount;
                        if (HasNum(args, "wage_amount"))
                        {
                            var nw = (decimal)Num(args, "wage_amount", (double)a.WageAmount);
                            if (nw != a.WageAmount) changes.Add(new AiActionField { Label = "Wage amount", From = $"Rs {a.WageAmount:N0}", To = $"Rs {nw:N0}", Changed = true });
                            wage = nw;
                        }
                        var curEnd = a.EndDate.HasValue ? a.EndDate.Value.ToString("yyyy-MM-dd") : "";
                        var nextEnd = Pick("end_date", curEnd, "End date");

                        var dto = new CreateAssignmentDto
                        {
                            EmployeeID = a.EmployeeID, ProjectID = a.ProjectID,
                            Role = Pick("role", a.Role, "Role"),
                            WageType = Pick("wage_type", a.WageType, "Wage type"),
                            WageAmount = wage,
                            StartDate = a.StartDate,
                            EndDate = ParseDate(string.IsNullOrWhiteSpace(nextEnd) ? null : nextEnd),
                            Status = Pick("status", a.Status, "Status"),
                            Notes = string.IsNullOrWhiteSpace(Pick("notes", a.Notes ?? "", "Notes")) ? null : Str(args, "notes", a.Notes ?? "")
                        };
                        if (changes.Count == 0)
                            return new { prepared = false, message = "Nothing would change for that assignment." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "edit_assignment", Title = "Update assignment", Summary = $"Update {a.EmployeeName} on {a.ProjectTitle}.",
                            Method = "PUT", Url = $"/assignments/{id}", Payload = dto, ConfirmLabel = "Save changes", Fields = changes
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            if (canAssignDelete)
            {
                tools.Add(new AiTool("draft_delete_assignment",
                    "Prepare the DELETE of an assignment for the user to confirm. Pass assignment_id (use assignments_overview). Never say it is deleted, the user must confirm.",
                    new { type = "object", properties = new { assignment_id = new { type = "integer", description = "The assignment's id, from assignments_overview" } }, required = new[] { "assignment_id" } },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "assignment_id", 0);
                        var all = await _assignments.GetAllAsync();
                        var a = all.FirstOrDefault(x => x.AssignmentID == id);
                        if (a == null)
                            return new { prepared = false, message = "I couldn't find that assignment. Use assignments_overview to get the right one." };

                        _proposed = new AiProposedAction
                        {
                            Kind = "delete_assignment", Title = "Remove assignment", Summary = $"Remove {a.EmployeeName} from {a.ProjectTitle}.",
                            Method = "DELETE", Url = $"/assignments/{id}", Payload = null, ConfirmLabel = "Remove", Danger = true,
                            Note = "This removes the assignment. To keep the record instead, you can end it rather than delete it.",
                            Fields = new()
                            {
                                new() { Label = "Worker", Value = a.EmployeeName },
                                new() { Label = "Project", Value = a.ProjectTitle },
                                new() { Label = "Role", Value = a.Role }
                            }
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            // Approvals
            if (await Can("Approvals"))
            {
                tools.Add(new AiTool("pending_approvals",
                    "Requests waiting for approval.",
                    noArgs,
                    async (_, __) =>
                    {
                        var pending = await _approvals.GetPendingAsync();
                        return new
                        {
                            count = pending.Count,
                            approvals = pending.Select(a => new { id = a.PendingActionID, requested_by = a.RequestedByName, module = a.Module, action = a.Action, target = a.TargetName, reason = a.Reason, date = a.CreatedAt.ToString("yyyy-MM-dd") })
                        };
                    }));
            }

            // Approve or reject a pending request (prepared for the user to confirm)
            if (canApprovalsManage)
            {
                tools.Add(new AiTool("draft_resolve_approval",
                    "Prepare the approval or rejection of a pending request for the user to confirm. Use pending_approvals first to get the id. Never say it is done, the user must confirm the card.",
                    new
                    {
                        type = "object",
                        properties = new
                        {
                            approval_id = new { type = "integer", description = "The pending request id, from pending_approvals" },
                            decision = new { type = "string", @enum = new[] { "approve", "reject" }, description = "Approve or reject" },
                            reason = new { type = "string", description = "Optional note shown to the requester" }
                        },
                        required = new[] { "approval_id", "decision" }
                    },
                    async (args, __) =>
                    {
                        var id = (int)Num(args, "approval_id", 0);
                        var status = Str(args, "decision", "approve").Trim().ToLowerInvariant() == "reject" ? "Rejected" : "Approved";
                        var pending = await _approvals.GetPendingAsync();
                        var p = pending.FirstOrDefault(x => x.PendingActionID == id);
                        if (p == null)
                            return new { prepared = false, message = "I couldn't find a pending request with that id. Use pending_approvals to list them." };

                        var reason = StrOrNull(args, "reason");
                        var fields = new List<AiActionField>
                        {
                            new() { Label = "Request", Value = $"{p.Action} {p.TargetName}" },
                            new() { Label = "Module", Value = p.Module },
                            new() { Label = "Requested by", Value = p.RequestedByName }
                        };
                        if (!string.IsNullOrWhiteSpace(reason)) fields.Add(new() { Label = "Reason", Value = reason });

                        _proposed = new AiProposedAction
                        {
                            Kind = status == "Approved" ? "approve_request" : "reject_request",
                            Title = status == "Approved" ? "Approve request" : "Reject request",
                            Summary = $"{status}: {p.RequestedByName}'s request to {p.Action.ToLowerInvariant()} {p.TargetName}.",
                            Method = "PUT", Url = $"/approvals/{id}/resolve",
                            Payload = new ResolvePendingActionDto { Status = status, Reason = reason },
                            ConfirmLabel = status == "Approved" ? "Approve" : "Reject",
                            Danger = status == "Rejected",
                            Fields = fields
                        };
                        return new { prepared = true, summary = _proposed.Summary };
                    }));
            }

            // Material requests from the field
            if (await Can("MaterialRequests"))
            {
                tools.Add(new AiTool("material_requests",
                    "Site material requests waiting to be approved or rejected.",
                    noArgs,
                    async (_, __) =>
                    {
                        var all = await _matRequests.GetAllAsync();
                        var pending = all.Where(r => r.Status == "Pending")
                            .Select(r => new { project = r.ProjectTitle, material = r.MaterialName, quantity = r.Quantity, unit = r.Unit, requested_by = r.RequestedByName, available_stock = r.AvailableStock })
                            .ToList();
                        return new { count = pending.Count, requests = pending };
                    }));
            }

            // Website messages
            if (await Can("Messages"))
            {
                tools.Add(new AiTool("recent_messages",
                    "Recent website messages (inquiries from customers), newest first.",
                    noArgs,
                    async (_, __) =>
                    {
                        var all = await _inquiries.GetAllInquiriesAsync();
                        var unread = all.Count(i => !i.IsRead);
                        var recent = all.OrderByDescending(i => i.CreatedAt).Take(10)
                            .Select(i => new { name = i.Name, phone = i.Phone, service = i.Service, message = i.Message.Length > 200 ? i.Message[..200] : i.Message, read = i.IsRead, date = i.CreatedAt.ToString("yyyy-MM-dd") })
                            .ToList();
                        return new { unread_count = unread, total = all.Count, recent };
                    }));
            }

            // The user's own notifications (no module permission needed)
            tools.Add(new AiTool("my_notifications",
                "How many unread notifications and alerts the current user has.",
                noArgs,
                async (_, __) =>
                {
                    var unread = await _notifications.GetUnreadCountAsync(userId);
                    var alerts = await _notifications.GetUnreadAlertCountAsync(userId);
                    return new { unread_notifications = unread, unread_alerts = alerts };
                }));

            return tools;
        }

        private async Task<object> CreateInquiryAsync(JsonElement args, CancellationToken ct)
        {
            var dto = new CreateInquiryDto
            {
                Name = Str(args, "name", ""),
                Phone = Str(args, "phone", ""),
                Email = StrOrNull(args, "email"),
                Service = StrOrNull(args, "service"),
                Message = Str(args, "message", "")
            };

            var (success, message) = await _inquiries.SubmitInquiryAsync(dto);
            if (!success)
                return new { success = false, message };

            var about = string.IsNullOrWhiteSpace(dto.Service) ? "" : $" about {dto.Service.Trim()}";
            await _notifications.NotifyPermissionHoldersAsync(
                "Messages", "View", NotificationCategories.Message, "New website message",
                $"{dto.Name.Trim()} sent a message from the website{about}.",
                link: NotificationLinks.Messages);

            return new { success = true, message = "Saved. The team will reply within 24 hours." };
        }

        // Small readers for tool arguments (the AI sends them as JSON).
        private static double Num(JsonElement args, string name, double fallback) =>
            args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var v)
                ? (v.ValueKind == JsonValueKind.Number ? v.GetDouble()
                   : double.TryParse(v.GetString(), out var d) ? d : fallback)
                : fallback;

        private static string Str(JsonElement args, string name, string fallback) =>
            args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
                ? (v.GetString() ?? fallback) : fallback;

        private static string? StrOrNull(JsonElement args, string name)
        {
            var s = Str(args, name, "");
            return string.IsNullOrWhiteSpace(s) ? null : s;
        }

        private static DateTime? ParseDate(string? s) =>
            !string.IsNullOrWhiteSpace(s)
                && DateTime.TryParse(s, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var d)
                ? d : null;

        private static bool HasNum(JsonElement args, string name) =>
            args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number;

        private static bool GetBool(JsonElement args, string name, bool fallback) =>
            args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var v)
                ? (v.ValueKind == JsonValueKind.True || (v.ValueKind == JsonValueKind.False ? false : fallback))
                : fallback;
    }
}
