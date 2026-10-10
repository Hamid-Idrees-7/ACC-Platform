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
            if (reply.Ok) return Ok(new { reply = reply.Text });
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

            var canMoney = isAdmin || await MoneyAccess.CanSeeAsync(User, _permissions, MoneyAccess.ProjectMoney);
            var canWages = isAdmin || await MoneyAccess.CanSeeAsync(User, _permissions, MoneyAccess.Wages);
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
                            .Select(m => new { name = m.Name, unit = m.Unit, current_stock = m.CurrentStock, low_stock_threshold = m.LowStockThreshold, status = m.Status, stock_value = canMoney ? (decimal?)m.StockValue : null })
                            .ToList();
                        return new { count = found.Count, materials = found };
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
                            .Select(a => new { employee = a.EmployeeName, project = a.ProjectTitle, role = a.Role, wage_type = a.WageType, wage = canWages ? (decimal?)a.WageAmount : null })
                            .ToList();
                        return new { count = active.Count, assignments = active };
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
                            approvals = pending.Select(a => new { requested_by = a.RequestedByName, module = a.Module, action = a.Action, target = a.TargetName, reason = a.Reason, date = a.CreatedAt.ToString("yyyy-MM-dd") })
                        };
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
    }
}
