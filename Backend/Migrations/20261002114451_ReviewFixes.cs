using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class ReviewFixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing duplicates are cleared before the unique indexes are created.
            // Attendance: keep the latest row per assignment and day.
            migrationBuilder.Sql(@"
WITH d AS (SELECT ROW_NUMBER() OVER (PARTITION BY AssignmentID, [Date] ORDER BY UpdatedAt DESC, AttendanceID DESC) AS rn FROM Attendances)
DELETE FROM d WHERE rn > 1;");

            // Salary: keep the first payment of each line (a second one was a double payment).
            migrationBuilder.Sql(@"
WITH d AS (SELECT ROW_NUMBER() OVER (PARTITION BY EmployeeID, [Year], [Month], SourceType, AssignmentID ORDER BY PaymentID) AS rn FROM SalaryPayments)
DELETE FROM d WHERE rn > 1;");

            // Permissions: keep the latest row per user, module and action.
            migrationBuilder.Sql(@"
WITH d AS (SELECT ROW_NUMBER() OVER (PARTITION BY UserID, Module, [Action] ORDER BY UpdatedAt DESC, PermissionID DESC) AS rn FROM UserPermissions)
DELETE FROM d WHERE rn > 1;");

            // Invoice numbers and usernames are renamed, never deleted: the second one gets a suffix.
            migrationBuilder.Sql(@"
WITH d AS (SELECT InvoiceNumber, ROW_NUMBER() OVER (PARTITION BY InvoiceNumber ORDER BY InvoiceID) AS rn FROM Invoices)
UPDATE d SET InvoiceNumber = LEFT(InvoiceNumber, 16) + '-' + CAST(rn AS varchar(3)) WHERE rn > 1;");
            migrationBuilder.Sql(@"
WITH d AS (SELECT Username, ROW_NUMBER() OVER (PARTITION BY Username ORDER BY UserID) AS rn FROM Users)
UPDATE d SET Username = LEFT(Username, 46) + '-' + CAST(rn AS varchar(3)) WHERE rn > 1;");

            migrationBuilder.DropIndex(
                name: "IX_Attendances_AssignmentID",
                table: "Attendances");

            migrationBuilder.AddColumn<int>(
                name: "LastInvoiceSeq",
                table: "CompanySettings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPermissions_UserID_Module_Action",
                table: "UserPermissions",
                columns: new[] { "UserID", "Module", "Action" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_EmployeeID_Year_Month_SourceType_AssignmentID",
                table: "SalaryPayments",
                columns: new[] { "EmployeeID", "Year", "Month", "SourceType", "AssignmentID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserID_Type_IsRead",
                table: "Notifications",
                columns: new[] { "UserID", "Type", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices",
                column: "InvoiceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inquiries_Phone_CreatedAt",
                table: "Inquiries",
                columns: new[] { "Phone", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_AssignmentID_Date",
                table: "Attendances",
                columns: new[] { "AssignmentID", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_UserPermissions_UserID_Module_Action",
                table: "UserPermissions");

            migrationBuilder.DropIndex(
                name: "IX_SalaryPayments_EmployeeID_Year_Month_SourceType_AssignmentID",
                table: "SalaryPayments");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserID_Type_IsRead",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Inquiries_Phone_CreatedAt",
                table: "Inquiries");

            migrationBuilder.DropIndex(
                name: "IX_Attendances_AssignmentID_Date",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "LastInvoiceSeq",
                table: "CompanySettings");

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_AssignmentID",
                table: "Attendances",
                column: "AssignmentID");
        }
    }
}
