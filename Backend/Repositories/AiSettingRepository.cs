using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class AiSettingRepository : IAiSettingRepository
    {
        private readonly AppDbContext _context;

        public AiSettingRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<AiSetting> GetAsync()
        {
            var row = await _context.AiSettings.FirstOrDefaultAsync();
            if (row == null)
            {
                row = new AiSetting();
                _context.AiSettings.Add(row);
                await _context.SaveChangesAsync();
            }
            return row;
        }

        public async Task UpdateAsync(AiSetting setting)
        {
            _context.AiSettings.Update(setting);
            await _context.SaveChangesAsync();
        }
    }
}
