using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class SalaryPayInParts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SalaryPayments_EmployeeID_Year_Month_SourceType_AssignmentID",
                table: "SalaryPayments");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_EmployeeID_Year_Month_SourceType_AssignmentID",
                table: "SalaryPayments",
                columns: new[] { "EmployeeID", "Year", "Month", "SourceType", "AssignmentID" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SalaryPayments_EmployeeID_Year_Month_SourceType_AssignmentID",
                table: "SalaryPayments");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_EmployeeID_Year_Month_SourceType_AssignmentID",
                table: "SalaryPayments",
                columns: new[] { "EmployeeID", "Year", "Month", "SourceType", "AssignmentID" },
                unique: true);
        }
    }
}
