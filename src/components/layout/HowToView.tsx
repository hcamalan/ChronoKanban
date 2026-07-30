import type { ReactNode } from 'react'

interface ChapterProps {
  title: string
  children: ReactNode
}

function Chapter({ title, children }: ChapterProps) {
  return (
    <details className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <summary className="cursor-pointer select-none rounded-lg px-4 py-3 text-lg font-medium text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800">
        {title}
      </summary>
      <div className="space-y-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700">{children}</div>
    </details>
  )
}

function SubChapter({ title, children }: ChapterProps) {
  return (
    <div>
      <h3 className="mb-1 font-medium text-gray-800 dark:text-gray-200">{title}</h3>
      <div>{children}</div>
    </div>
  )
}

export function HowToView() {
  return (
    <div className="mx-auto max-w-3xl p-4 text-sm text-gray-700 dark:text-gray-300 sm:p-6">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">How to use ChronoKanban</h1>

      <p className="mb-6">
        ChronoKanban is the task tracking tool you didn't know you needed. It's a Kanban board with built-in time
        tracking, analytics dashboards, and a calendar view - running entirely in your browser, with no account
        and no server. Your boards and tasks never leave your browser unless you explicitly turn on a sync option.
      </p>

      <p className="mb-6">
        ChronoKanban is built for individual use, not for coordinating a team. Because all data lives only in your
        own browser with nothing shared or synced, there's no practical way for multiple people to see or work
        from the same board - trying to use it as a team's shared tracker won't work the way a server-backed tool
        would. The <strong>Assignee</strong> field on task cards is still there, though - not as a step toward
        team features, but simply to give you the flexibility to use it however suits you, even on a personal
        board.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Use cases</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong>Effortless time reports.</strong> Asked what you worked on last month with nothing to show for
            it? Track your tasks as you go and let ChronoKanban build the report for you - open the Dashboard,
            pick a board, and download a ready-to-share CSV timesheet in seconds.
          </li>
          <li>
            <strong>See where your time actually goes.</strong> The Dashboard's configurable chart and calendar
            view turn weeks of scattered work into a clear picture of how your time is split across categories,
            statuses, and priorities.
          </li>
          <li>
            <strong>A tracker for anything with moving parts.</strong> Job applications, house projects, side
            hustles, errands - spin up a dedicated board in seconds, capture every detail on a card, and always
            know exactly where things stand.
          </li>
          <li>
            <strong>Private by design.</strong> No sign-up, no account, no data ever leaving your browser - and it
            keeps working with no internet connection at all once it's loaded.
          </li>
        </ul>
      </section>

      <Chapter title="The example board">
        <p>
          The first time you open ChronoKanban, you'll see a worked example board ("Example board (Developer)")
          with a set of realistic tasks already tracked, so the dashboard and calendar aren't staring back at you
          empty. It's a normal board - delete it like any other whenever you're ready to start your own. If you
          ever use Settings → <strong>Delete all my data</strong> to wipe everything, it comes back automatically.
        </p>
      </Chapter>
      
      <Chapter title="Boards, buckets & tasks">
        <p>
          A <strong>board</strong> is a project or area of your life (e.g. "Work" or "Home"). Each board has{' '}
          <strong>buckets</strong> - columns like "To Do", "In Progress", "Done" - and each bucket holds{' '}
          <strong>task cards</strong>.
        </p>
        <p>
          Drag a card between buckets on the same board to move it along, and drag boards or buckets themselves to
          reorder them. To move a task to a <em>different</em> board, open the task and change its "Board" field
          instead.
        </p>
        <p>
          Collapse a bucket using the chevron next to its name to save space - on a touchscreen, tap anywhere on a
          collapsed bucket's name to expand it again. Deleting a bucket that still has tasks in it asks for
          confirmation first.
        </p>
        <p>
          On a touchscreen, press and hold a card briefly to start dragging it - buckets collapse automatically to
          make room while you drag, and the one you're hovering over is highlighted. You can also swipe a card left
          to delete it, with a few seconds to undo afterward.
        </p>
      </Chapter>

      <Chapter title="Tracking time">
        <SubChapter title="Starting and pausing">
          <p>
            Every task card has a play button. Click it to start the clock; click it again (now a pause button) to
            pause. The elapsed time keeps counting even if you close the tab and come back later.
          </p>
        </SubChapter>
        <SubChapter title="Correcting elapsed time">
          <p>
            Forgot to start or stop the timer? A task's extended view has an editable <strong>Time elapsed</strong>{' '}
            field (H:MM) - type in the correct total and it's applied immediately. The difference is credited to
            today in the timesheet download, so your report stays accurate even after a correction.
          </p>
        </SubChapter>
        <SubChapter title="Resetting">
          <p>To reset a task's time back to zero, open its extended view - it's the only place with a Reset control.</p>
        </SubChapter>
        <SubChapter title="Estimates">
          <p>
            Give a task an <strong>Estimated hours</strong> value and ChronoKanban shows how tracked time compares
            - inline in the task view (red when you've gone over), and on the Dashboard as an average across
            completed tasks, so you learn how accurate your estimates really are.
          </p>
        </SubChapter>
      </Chapter>

      <Chapter title="Organizing & finding tasks">
        <SubChapter title="Categories">
          <p>
            Categories are per-board labels with a color, used to group and chart your tasks (e.g. "Work",
            "Family", "Health"). Manage a board's categories at the bottom of its page, and assign one to a task
            from its extended view.
          </p>
        </SubChapter>
        <SubChapter title="Urgency & importance">
          <p>Tag a task's urgency and importance from its extended view to prioritize and filter by them later.</p>
        </SubChapter>
        <SubChapter title="Sub-tasks">
          <p>
            Break a task down into a checklist of smaller steps from its extended view. Double-click a sub-task
            to rename it, and drag the handle next to it to reorder the list.
          </p>
        </SubChapter>
        <SubChapter title="Descriptions">
          <p>
            Task descriptions support <strong>markdown</strong> - links, bold, and lists render automatically, and
            links open in a new tab. Click the rendered text to edit it.
          </p>
        </SubChapter>
        <SubChapter title="Assignee">
          <p>
            Assign a task to someone in its extended view - names you've used before are suggested as you type.
          </p>
        </SubChapter>
        <SubChapter title="Recurring due dates">
          <p>
            Turn on "Repeat" on a task's due date to have it recur on a fixed interval (e.g. every 2 weeks) once
            completed.
          </p>
        </SubChapter>
        <SubChapter title="Search & bulk actions">
          <p>
            On desktop, press <strong>/</strong> or use the search box next to <strong>Select</strong> to filter
            a board's tasks instantly (not shown on mobile, where a board's task list is usually short enough not
            to need it). Click <strong>Select</strong> to check off multiple tasks at once and move, complete, or
            delete them together - available on both desktop and mobile.
          </p>
        </SubChapter>
      </Chapter>

      <Chapter title="Completing tasks">
        <p>
          Check a task's checkbox (on the card or in its extended view) to mark it done. Completed tasks get
          greyed out with a strikethrough, their timer stops automatically, and they move into the bucket's
          collapsed "Completed (X)" section - click that text to expand or collapse it.
        </p>
      </Chapter>

      <Chapter title="Today view">
        <p>
          The <strong>Today</strong> tab (or the <strong>T</strong> key) is your daily agenda across all boards:
          what's running right now, what's flagged, what's due today, what's overdue, what you've already
          completed today - and a live total of the time you've tracked so far. If any timers are running, a
          banner at the top lets you pause all of them (or just the ones that have been running unusually long)
          in one click.
        </p>
        <p>
          Don't use time tracking or due dates? Click the flag icon in a task card's top-right corner (or the
          same icon in its extended view) to put it on today's list directly, no timer or date required. A
          flagged task keeps showing up in Today until you unflag it or complete it - and if you complete it
          today, it stays visible (checked off) for the rest of the day instead of disappearing immediately.
        </p>
      </Chapter>

      <Chapter title="Dashboard & Calendar">
        <SubChapter title="Performance metrics">
          <p>
            Three headline numbers: your on-time completion rate, story points completed per hour tracked, and how
            your tracked time compares to your estimates. Minimize the whole group with the chevron next to{' '}
            <strong>Performance metrics</strong> - it stays minimized across visits until you expand it again.
          </p>
        </SubChapter>
        <SubChapter title="Configurable chart">
          <p>
            Choose what to <strong>measure</strong> (number of tasks, time spent, or story points), what to{' '}
            <strong>group by</strong> (category, status, importance, urgency, or late), and which tasks to include
            via the filter dropdowns - then view it as a bar or pie chart. Pick a specific board to break down by
            category; grouping by status/urgency/importance/late also works across all boards combined. Click the
            chevron next to <strong>Chart</strong> to minimize it if you don't need it visible - it stays
            minimized the next time you open the Dashboard, until you expand it again.
          </p>
        </SubChapter>
        <SubChapter title="Calendar view">
          <p>
            Switch to day, 3-day, week, or month view to see bars for what you worked on, what's due, and what's
            overdue, laid out on a real calendar. Like the chart, it can be minimized with the chevron next to{' '}
            <strong>Calendar</strong>, and stays that way until you expand it again.
          </p>
        </SubChapter>
        <SubChapter title="Late tasks">
          <p>
            A list of everything overdue across the boards in scope, also minimizable and persisted the same way
            as the sections above.
          </p>
        </SubChapter>
        <SubChapter title="Exporting">
          <p>
            Download the chart or calendar as a PNG image directly from their own download button, or use{' '}
            <strong>Download report</strong> to export a full CSV timesheet - one row per day and task you tracked
            time on, with hours spent and the task's status at the end of that day.
          </p>
        </SubChapter>
      </Chapter>

      <Chapter title="Keyboard shortcuts">
        <p>
          ChronoKanban has a full set of keyboard shortcuts for creating boards/buckets/tasks, navigating, undo,
          and more. Click <strong>Hotkeys</strong> in the top bar, or press <strong>?</strong>, to see the full
          list at any time.
        </p>
      </Chapter>

      <Chapter title="Preferences">
        <p>
          Open <strong>Settings</strong> in the top bar to adjust dark mode, bucket width, date format, a
          colorblind-safe color mode, and whether task descriptions show directly on their cards.
        </p>
        <p>
          You can also enable <strong>desktop notifications</strong> there: ChronoKanban will warn you when a
          timer has been running for over 8 hours, and give you a once-a-day summary of tasks due today or
          overdue. Since there's no server, notifications only fire while the app is open in a tab.
        </p>
      </Chapter>

      <Chapter title="Backing up your data">
        <p>
          Since everything is stored locally, clearing your browser data would erase it — including browser
          settings like Chrome's "Clear cookies and site data when you close all windows," which can
          automatically be turned on without you knowing it. In this case, your data would be deleted after you
          close the browser window. Installing ChronoKanban as an app
          also tends to be more durable than a regular tab. Open <strong>Settings</strong> and use{' '}
          <strong>Export</strong> any time to download a full backup as a JSON file, and{' '}
          <strong>Import</strong> to restore it later or move it to another browser or device. Importing
          replaces everything currently in the app, so use it carefully.
        </p>
        <p>
          For a more hands-off option, <strong>Settings → Auto-sync folder</strong> lets you pick a folder once
          and keeps a file there automatically up to date - pushed a few seconds after each change, and pulled
          back in when you open the app if the file there is newer than what this browser last saw (so opening
          ChronoKanban elsewhere pointed at the same folder picks up your latest data). It's a straight
          newest-wins swap, not a merge, so it's meant for one person using a couple of devices one at a time
          rather than editing in two places at once. It's only available in Chromium-based browsers (Chrome,
          Edge, Brave, Opera - not Firefox or Safari), and fully closing and reopening the browser may need one
          "Reconnect" click before it resumes.
        </p>
        <p>
          <strong>Settings → Google Drive sync (beta)</strong> works the same way but through a "ChronoKanban"
          folder in your Google Drive instead of a local folder - the point being it works across different
          computers, not just different browser profiles on the same machine. It's in limited beta for now:
          it's still going through Google's app-verification process, so it only works for Google accounts that
          have been granted access, and other accounts will see an "app isn't verified" screen from Google when
          they try to connect. Connecting one of Auto-sync folder or Google Drive
          sync disconnects the other, since only one can be the active source of truth at a time. An open, idle
          tab checks Drive for changes every couple of minutes; if it finds something newer and this tab has no
          unsynced changes of its own, it pulls it in automatically, otherwise it shows a banner asking you to
          pull manually rather than risk overwriting what you were doing. Google's sign-in only lasts about an
          hour at a time, and re-signing in is usually silent but occasionally needs a click.
        </p>
        <p>
          Google Drive sync can also be shared: connecting for the first time offers a choice between{' '}
          <strong>Create new sync file</strong> (today's behavior) and <strong>Open a shared file…</strong>, for
          joining a file someone else already created and shared with you (as an Editor, from Drive's own sharing
          UI). This makes a small-team shared board possible, but it's still the same full-replace, newest-wins
          sync described above with no real merge - if you and a teammate both edit around the same time,
          whoever's change syncs last overwrites the other's. Fine with one person using it at a time; worth
          knowing about before relying on it for simultaneous editing.
        </p>
        <p>
          The first time you use ChronoKanban, a one-time banner also nudges you to back up early - export once
          or dismiss it and it won't show again.
        </p>
        <p>
          If it's been more than a week since your last export, the Boards page shows a gentle reminder (after a
          few days' grace period on a brand-new install) - take it seriously: a browser cleanup can wipe local
          data without asking.
        </p>
      </Chapter>

      <Chapter title="Working offline">
        <p>
          By default, ChronoKanban makes no network calls at all - all your data lives in this browser's local
          storage. Once you've loaded it here, it keeps working with no internet connection at all, and it can be
          installed like an app - ChronoKanban offers a one-time install prompt (or, on iPhone/iPad, instructions
          for adding it to your home screen), or you can always do it manually from your browser's menu.
        </p>
        <p>
          The only network activity in the app, ever, is something you explicitly turn on (Auto-sync folder or
          Google Drive sync), or a small anonymous, cookieless page-view counter used to see whether the app is
          getting any use at all - no personal data, no cookies, and it never touches your boards or tasks.
        </p>
        <p>
          To run it on a machine with no internet access whatsoever, download the source, run{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">npm run build</code>, and serve the resulting{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">dist/</code> folder locally - no further
          setup or connection is required.
        </p>
      </Chapter>
    </div>
  )
}
