namespace Backend
{
    // The company's own clock. "Today" (attendance, pay earned so far, overdue invoices, alerts)
    // follows the company's time zone, not the server's, so a cloud server on UTC still changes
    // day at local midnight. Set with App:TimeZone (eg "Asia/Karachi"); the server's zone if unset.
    public static class AppTime
    {
        private static TimeZoneInfo _zone = TimeZoneInfo.Local;

        public static void Configure(string? zoneId)
        {
            if (!string.IsNullOrWhiteSpace(zoneId) && TimeZoneInfo.TryFindSystemTimeZoneById(zoneId.Trim(), out var zone))
                _zone = zone;
        }

        public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _zone);
        public static DateTime Today => Now.Date;
    }
}
