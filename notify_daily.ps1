# notify_daily.ps1 - Daily notification for CampusFlow

# Path to data.json
$AppDir = "c:\Users\owner\Documents\university-timetable-app"
$JsonPath = Join-Path $AppDir "data.json"

if (-not (Test-Path $JsonPath)) {
    exit
}

try {
    $Data = Get-Content $JsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    exit
}

# Determine today's day of week (1=Mon, 2=Tue, ..., 7=Sun)
$Now = Get-Date
$DayOfWeek = [int]$Now.DayOfWeek
if ($DayOfWeek -eq 0) { $DayOfWeek = 7 } # Convert Sunday to 7

# Get current semester filter
$Semester = "1年 1Q"
if ($Data.profile -and $Data.profile.semester) {
    $Semester = $Data.profile.semester
}

# Check if class matches semester
function IsClassInActiveSemester($c, $activeSemester) {
    if ($c.semester -eq $activeSemester) { return $true }
    
    # Check multi-quarter spans
    if ($activeSemester.EndsWith(" 1Q") -or $activeSemester.EndsWith(" 2Q")) {
        $yearPrefix = $activeSemester.Split(" ")[0]
        if ($c.semester -eq "$yearPrefix 1-2Q") { return $true }
    }
    if ($activeSemester.EndsWith(" 3Q") -or $activeSemester.EndsWith(" 4Q")) {
        $yearPrefix = $activeSemester.Split(" ")[0]
        if ($c.semester -eq "$yearPrefix 3-4Q") { return $true }
    }
    return $false
}

# Filter classes for today
$TodayClasses = @()
if ($Data.classes) {
    foreach ($c in $Data.classes) {
        if ($c.day -eq $DayOfWeek -and (IsClassInActiveSemester $c $Semester) -and -not $c.isIntensive) {
            $TodayClasses += $c
        }
    }
}
# Sort classes by period
$TodayClasses = $TodayClasses | Sort-Object period

# Filter tasks due today and not completed
$TodayStr = $Now.ToString("yyyy-MM-dd")
$TodayTasks = @()
if ($Data.tasks) {
    foreach ($t in $Data.tasks) {
        if ($t.dueDate -eq $TodayStr -and -not $t.completed) {
            $TodayTasks += $t
        }
    }
}

# If there is nothing scheduled, we can show a relaxed morning notice or exit. Let's show a light notification!
$Title = "今日の予定 - CampusFlow"
$Body = ""

if ($TodayClasses.Count -gt 0) {
    $ClassList = @()
    foreach ($c in $TodayClasses) {
        $ClassList += "$($c.period)限:$($c.name)"
    }
    $Body += "本日の授業 ($($TodayClasses.Count)コマ): " + ($ClassList -join ", ")
} else {
    $Body += "今日の授業はありません。"
}

if ($TodayTasks.Count -gt 0) {
    $TaskList = @()
    foreach ($t in $TodayTasks) {
        $TaskList += $t.title
    }
    $Body += "`n本日締切の課題 ($($TodayTasks.Count)件): " + ($TaskList -join ", ")
}

# Show Windows Toast Notification
try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $Template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $TextNodes = $Template.GetElementsByTagName("text")
    $TextNodes.Item(0).AppendChild($Template.CreateTextNode($Title)) | Out-Null
    $TextNodes.Item(1).AppendChild($Template.CreateTextNode($Body)) | Out-Null

    $Notification = [Windows.UI.Notifications.ToastNotification]::new($Template)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("CampusFlow").Show($Notification)
} catch {
    # Fallback to simple popup if toast notification runtime is unavailable
    $wshell = New-Object -ComObject Wscript.Shell
    $wshell.Popup($Body, 0, $Title, 64) | Out-Null
}
