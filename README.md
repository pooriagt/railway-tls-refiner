# Railway TLS Config Refiner

نسخه Node.js پروژه TLS Config Refiner برای Deploy روی Railway.

## آپلود در GitHub
1. این ZIP را Extract کن.
2. وارد پوشه `railway-tls-refiner-github` شو.
3. همه فایل‌های داخل پوشه را انتخاب کن؛ خود پوشه را لازم نیست آپلود کنی.
4. در GitHub یک repository جدید بساز.
5. از **Add file → Upload files** استفاده کن و فایل‌ها را در ریشه repository بکش و رها کن.
6. پایین صفحه **Commit changes** را بزن.

## اتصال به Railway
1. وارد Railway شو و **New Project** را بزن.
2. گزینه **Deploy from GitHub repo** را انتخاب کن.
3. GitHub را وصل کن و repository ساخته‌شده را انتخاب کن.
4. صبر کن Deploy تمام شود.
5. وارد سرویس شو، بخش **Settings → Networking** را باز کن و **Generate Domain** را بزن.
6. دامنه ساخته‌شده را باز کن؛ صفحه TLS Config Refiner باید نمایش داده شود.

## تنظیمات
- Railway معمولاً `PORT` و `RAILWAY_PUBLIC_DOMAIN` را خودکار فراهم می‌کند.
- اگر دامنه به‌صورت خودکار تشخیص داده نشد، متغیر `PUBLIC_DOMAIN` را با دامنه Railway و بدون `https://` تنظیم کن.
- متغیر اختیاری `ALLOWED_WS_HOSTS` برای محدودکردن مقصدهای WebSocket است؛ چند دامنه را با کاما جدا کن. مثال: `origin.example.com,cdn.example.net`.
- برای شروع، `ALLOWED_WS_HOSTS` را خالی بگذار؛ بعد از تست، آن را به دامنه‌های مقصد مورداعتماد محدود کن.

## نکته مهم درباره Clean IP
در Cloudflare Worker، آدرس Clean IP می‌توانست به‌عنوان مقصد اتصال استفاده شود چون ترافیک از شبکه Cloudflare عبور می‌کرد. در Railway این روش معتبر نیست. این نسخه آدرس کانفیگ خروجی را روی دامنه عمومی خود Railway قرار می‌دهد؛ بنابراین فیلد Clean IP حذف شده است.

## محدودیت و تست
این نسخه برای ورودی‌های VMess / VLESS / Trojan با WS+TLS نوشته شده است. Deploy موفق به‌تنهایی تضمین‌کننده سازگاری تمام کلاینت‌ها یا مقصدهای upstream نیست؛ پس از Deploy حتماً با یک کانفیگ آزمایشی و مقصد WebSocket مجاز تست کن.
