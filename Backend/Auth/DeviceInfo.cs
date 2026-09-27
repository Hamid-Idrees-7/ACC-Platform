using System.Text.RegularExpressions;

namespace Backend.Auth
{
    // Turns a browser's user agent into a short label for Settings > Security,
    // eg "Chrome" on "Windows", shown as a desktop, phone or tablet.
    public record DeviceInfo(string Browser, string Os, string Kind)
    {
        public static DeviceInfo From(string? userAgent)
        {
            var ua = userAgent ?? string.Empty;
            if (ua.Length == 0) return new DeviceInfo("Unknown browser", "Unknown device", "desktop");

            var browser =
                Has(ua, @"Edg(e|A|iOS)?/") ? "Edge" :
                Has(ua, @"OPR/|Opera") ? "Opera" :
                Has(ua, @"SamsungBrowser/") ? "Samsung Internet" :
                Has(ua, @"Firefox/|FxiOS/") ? "Firefox" :
                Has(ua, @"Chrome/|CriOS/") ? "Chrome" :
                Has(ua, @"Safari/") && Has(ua, @"Version/") ? "Safari" :
                Has(ua, @"PostmanRuntime") ? "Postman" :
                "Other browser";

            var os =
                Has(ua, @"iPad") ? "iPadOS" :
                Has(ua, @"iPhone|iPod") ? "iOS" :
                Has(ua, @"Android") ? "Android" :
                Has(ua, @"Windows") ? "Windows" :
                Has(ua, @"CrOS") ? "ChromeOS" :
                Has(ua, @"Mac OS X|Macintosh") ? "macOS" :
                Has(ua, @"Linux") ? "Linux" :
                "Unknown device";

            var kind =
                Has(ua, @"iPad|Tablet") || (Has(ua, @"Android") && !Has(ua, @"Mobile")) ? "tablet" :
                Has(ua, @"Mobile|iPhone|iPod") ? "phone" :
                "desktop";

            return new DeviceInfo(browser, os, kind);
        }

        private static bool Has(string ua, string pattern) => Regex.IsMatch(ua, pattern, RegexOptions.IgnoreCase);
    }
}
