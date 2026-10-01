using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class InquiryService : IInquiryService
    {
        private readonly IInquiryRepository _repository;

        // Spam protection limits
        private const int RateLimitMinutes = 5;
        private const int MaxMessagesPerWindow = 3;

        public InquiryService(IInquiryRepository repository)
        {
            _repository = repository;
        }

        public async Task<(bool Success, string Message)> SubmitInquiryAsync(CreateInquiryDto dto)
        {
            // Honeypot: only a bot fills in the hidden Website field.
            if (!string.IsNullOrWhiteSpace(dto.Website))
            {
                // Pretend it worked so the bot doesn't try again.
                return (true, "Thank you for your message.");
            }

            if (string.IsNullOrWhiteSpace(dto.Name) ||
                string.IsNullOrWhiteSpace(dto.Phone) ||
                string.IsNullOrWhiteSpace(dto.Message))
            {
                return (false, "Please fill in your name, phone, and message.");
            }

            // Block the phone number if it sent too many messages in the last few minutes.
            var since = DateTime.Now.AddMinutes(-RateLimitMinutes);
            var recentCount = await _repository.CountRecentByPhoneAsync(dto.Phone.Trim(), since);
            if (recentCount >= MaxMessagesPerWindow)
            {
                return (false, "You've sent several messages already. Please wait a little before sending more.");
            }

            var inquiry = new Inquiry
            {
                Name = dto.Name.Trim(),
                Phone = dto.Phone.Trim(),
                Email = dto.Email?.Trim(),
                Service = dto.Service?.Trim(),
                Message = dto.Message.Trim(),
                IsRead = false,
                CreatedAt = DateTime.Now
            };

            await _repository.AddAsync(inquiry);
            return (true, "Thank you! Your message has been sent. We'll be in touch soon.");
        }

        public async Task<List<InquiryDto>> GetAllInquiriesAsync()
        {
            var inquiries = await _repository.GetAllAsync();
            return inquiries.Select(ToDto).ToList();
        }

        public async Task<InquiryDto?> MarkAsReadAsync(int id)
        {
            var inquiry = await _repository.GetByIdAsync(id);
            if (inquiry == null) return null;

            if (!inquiry.IsRead)
            {
                inquiry.IsRead = true;
                await _repository.UpdateAsync(inquiry);   
            }
            return ToDto(inquiry);
        }

        public async Task<string?> GetSenderNameAsync(int id)
        {
            var inquiry = await _repository.GetByIdAsync(id);
            return inquiry?.Name;
        }

        public async Task<bool> DeleteInquiryAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        public async Task DeleteAllInquiriesAsync()
        {
            await _repository.DeleteAllAsync();
        }

        public async Task<int> GetUnreadCountAsync()
        {
            return await _repository.GetUnreadCountAsync();
        }

        private InquiryDto ToDto(Inquiry i)
        {
            return new InquiryDto
            {
                InquiryID = i.InquiryID,
                Name = i.Name,
                Phone = i.Phone,
                Email = i.Email,
                Service = i.Service,
                Message = i.Message,
                IsRead = i.IsRead,
                CreatedAt = i.CreatedAt
            };
        }
    }
}