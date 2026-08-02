using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Backend.Controllers
{
    // API endpoints for clients. Base route: /api/clients
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClientsController : ControllerBase
    {
        private readonly IClientService _service;

        // The service is injected here (Dependency Injection)
        public ClientsController(IClientService service)
        {
            _service = service;
        }

        // GET: /api/clients  -> get all clients
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var clients = await _service.GetAllClientsAsync();
            return Ok(clients);
        }

        // GET: /api/clients/5  -> get one client by ID
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var client = await _service.GetClientByIdAsync(id);
            if (client == null)
                return NotFound(new { message = "Client not found" });

            return Ok(client);
        }

        // POST: /api/clients  -> create a new client
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ClientDto dto)
        {
            var client = await _service.CreateClientAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = client.ClientID }, client);
        }

        // PUT: /api/clients/5  -> update a client
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ClientDto dto)
        {
            var client = await _service.UpdateClientAsync(id, dto);
            if (client == null)
                return NotFound(new { message = "Client not found" });

            return Ok(client);
        }

        // DELETE: /api/clients/5  -> delete a client
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _service.DeleteClientAsync(id);
            if (!deleted)
                return NotFound(new { message = "Client not found" });

            return Ok(new { message = "Client deleted successfully" });
        }
    }
}