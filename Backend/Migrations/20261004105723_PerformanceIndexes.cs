using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class PerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_Year_Month",
                table: "SalaryPayments",
                columns: new[] { "Year", "Month" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IsRead_CreatedAt",
                table: "Notifications",
                columns: new[] { "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MaterialTransactions_ProjectID",
                table: "MaterialTransactions",
                column: "ProjectID");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialRequests_Status",
                table: "MaterialRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_ProjectID",
                table: "Invoices",
                column: "ProjectID");

            migrationBuilder.CreateIndex(
                name: "IX_InvoicePayments_InvoiceID",
                table: "InvoicePayments",
                column: "InvoiceID");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_InvoiceID",
                table: "InvoiceItems",
                column: "InvoiceID");

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_Date",
                table: "Attendances",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_EmployeeID",
                table: "Assignments",
                column: "EmployeeID");

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_ProjectID",
                table: "Assignments",
                column: "ProjectID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SalaryPayments_Year_Month",
                table: "SalaryPayments");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_IsRead_CreatedAt",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_MaterialTransactions_ProjectID",
                table: "MaterialTransactions");

            migrationBuilder.DropIndex(
                name: "IX_MaterialRequests_Status",
                table: "MaterialRequests");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_ProjectID",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_InvoicePayments_InvoiceID",
                table: "InvoicePayments");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceItems_InvoiceID",
                table: "InvoiceItems");

            migrationBuilder.DropIndex(
                name: "IX_Attendances_Date",
                table: "Attendances");

            migrationBuilder.DropIndex(
                name: "IX_Assignments_EmployeeID",
                table: "Assignments");

            migrationBuilder.DropIndex(
                name: "IX_Assignments_ProjectID",
                table: "Assignments");
        }
    }
}
