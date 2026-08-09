using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IInquiryService
    {
        Task<(bool Success, string Message)> SubmitInquiryAsync(CreateInquiryDto dto);
        Task<List<InquiryDto>> GetAllInquiriesAsync();
        Task<InquiryDto?> MarkAsReadAsync(int id);
        Task<bool> DeleteInquiryAsync(int id);
        Task DeleteAllInquiriesAsync();
        Task<int> GetUnreadCountAsync();
    }
}