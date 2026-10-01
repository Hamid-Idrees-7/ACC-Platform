namespace Backend.Models.DTOs
{
    // Records a payment (full or partial) against an invoice.
    public class RecordPaymentDto
    {
        public int InvoiceID { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }

        public string Method { get; set; } = "Cash";

        // Optional: cheque number, transaction ID and so on.
        public string? Reference { get; set; }
    }
}
