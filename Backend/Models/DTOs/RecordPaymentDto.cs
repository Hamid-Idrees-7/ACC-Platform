namespace Backend.Models.DTOs
{
    // Payload for recording a (possibly partial) payment against an invoice.
    public class RecordPaymentDto
    {
        public int InvoiceID { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }

        public string Method { get; set; } = "Cash";

        // Cheque number, transaction id, etc Optional
        public string? Reference { get; set; }
    }
}
