using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IAiSettingRepository
    {
        // Returns the single settings row, creating it with defaults if it doesn't exist yet.
        Task<AiSetting> GetAsync();
        Task UpdateAsync(AiSetting setting);
    }
}
