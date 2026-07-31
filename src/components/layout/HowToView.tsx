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
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">How to use ChronoKanban Teams</h1>

      <p className="mb-6">
        ChronoKanban Teams is a collaborative Kanban board with built-in time tracking, analytics dashboards, and
        a calendar view. Everyone on a board sees each other's changes in real time, and it keeps working offline,
        syncing back up when you reconnect.
      </p>

      <p className="mb-6">
        It's the collaborative sibling of the original{' '}
        <a
          href="https://github.com/hcamalan/chronokanban"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline dark:text-blue-400"
        >
          ChronoKanban
        </a>{' '}
        - a privacy-first, individual app that deliberately keeps everything in your own browser with no server at
        all. Teams was built for the opposite need: sharing a board and working on it together. That's the core
        trade-off to keep in mind - your board is shared through a server (run by whoever set it up), rather than
        staying only on your device. The <strong>Assignee</strong> field on task cards comes into its own here for
        divvying work up between people.
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
            <strong>A shared board for a small team.</strong> Everyone joins the same board with one password and
            works on it together in real time - tasks, buckets, and time tracking stay in sync across everyone,
            and each person can still keep editing offline, syncing back up when they reconnect.
          </li>
        </ul>
      </section>

      <Chapter title="Working as a team">
        <SubChapter title="Joining a board">
          <p>
            When you open a ChronoKanban Teams board, you're asked for the <strong>board password</strong> - a
            single shared password set by whoever runs the board. Enter it once and this browser remembers it.
            There are no individual accounts: everyone uses the same password, and anyone who has it has full
            access to the board.
          </p>
        </SubChapter>
        <SubChapter title="Real-time sync & the connection indicator">
          <p>
            Everyone's changes - new tasks, moves, edits, timers, attachments - appear for everyone else within a
            moment. The dot next to the ChronoKanban Teams name in the top bar shows the connection: green{' '}
            <strong>Live</strong> when you're connected and synced, amber while connecting or catching up, and grey{' '}
            <strong>Offline</strong> when the server isn't reachable.
          </p>
        </SubChapter>
        <SubChapter title="Offline-first">
          <p>
            Being offline is fine: you can keep editing, and your changes are saved locally and sync up
            automatically once you're connected again. Because it merges changes rather than overwriting, two
            people editing at the same time both keep their work.
          </p>
        </SubChapter>
        <SubChapter title="Version history">
          <p>
            <strong>Settings → Version history</strong> keeps automatic snapshots of your boards on your device.
            Restoring one adds it back as a <em>new</em> board (it never overwrites the live one), so you can
            recover an earlier state without disrupting everyone else. You can also download any snapshot as a
            backup file.
          </p>
        </SubChapter>
        <SubChapter title="Leaving a board">
          <p>
            <strong>Settings → Leave board</strong> signs this browser out and forgets the password. If the person
            running the board changes the password, everyone is simply asked for the new one the next time they
            open it.
          </p>
        </SubChapter>
      </Chapter>

      <Chapter title="Your first board">
        <p>
          When you join a shared board, you'll see whatever's already on it - or an empty board if it's brand new
          and no one has added anything yet. Just start creating buckets and tasks; everyone else on the board
          sees them appear.
        </p>
        <p>
          (If you ever open ChronoKanban Teams <em>without</em> connecting to a server - i.e. purely local, like
          the original ChronoKanban - it seeds a worked "Example board (Developer)" on first run so the dashboard
          and calendar aren't empty. That example never appears on a shared board.)
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
          Use the <strong>Boards</strong> filter to check individual boards in or out - leave nothing checked to
          see everything, or narrow it down to just the boards you care about right now. The tracked-time total
          and "pause all" also follow whatever the filter is currently showing.
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
          overdue. These are generated by the app itself, so they only fire while ChronoKanban Teams is open in a
          tab (there are no pushed notifications).
        </p>
      </Chapter>

      <Chapter title="Backing up your data">
        <p>
          On a shared board, the board itself lives on its server, so clearing this browser's data just drops the
          local copy - it re-syncs when you reconnect and re-enter the board password. Even so, it's worth keeping
          your <em>own</em> backup: open <strong>Settings</strong> and use <strong>Export</strong> any time to
          download a full snapshot as a JSON file, and <strong>Import</strong> to restore it later or move it to
          another browser or device. Importing replaces everything currently in the app, so use it carefully.
          (Export/Import files use the same format as the original ChronoKanban, so you can move boards between the
          two.)
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
          ChronoKanban Teams is offline-first: a full copy of your board is cached in this browser, so it keeps
          working with no connection at all. Anything you change while offline is saved locally and syncs up to
          the board automatically once you're connected again - the connection dot in the top bar turns grey{' '}
          <strong>Offline</strong> and back to green <strong>Live</strong> as this happens.
        </p>
        <p>
          It can be installed like an app - ChronoKanban Teams offers a one-time install prompt (or, on
          iPhone/iPad, instructions for adding it to your home screen), or you can always do it manually from your
          browser's menu.
        </p>
        <p>
          Aside from talking to your board's own server, the only other network activity is a small anonymous,
          cookieless page-view counter used to see whether the app is getting any use at all - no personal data,
          no cookies, and it never touches your boards or tasks.
        </p>
      </Chapter>

      <Chapter title="Host your own board">
        <p>
          Want to run a board for your own team? You host two free pieces: the small sync <strong>server</strong>{' '}
          and the <strong>app</strong> itself. Here's the quick path we recommend (full details are in the{' '}
          <a
            href="https://github.com/hcamalan/chronokanban"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline dark:text-blue-400"
          >
            project repository
          </a>{' '}
          under <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">server/README.md</code>):
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Deploy the server on Railway.</strong> Create a project from the repo, set the service's{' '}
            <em>root directory</em> to <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">server</code>,
            and add a <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">COLLAB_TOKEN</code> variable - that
            value <em>is</em> your board password. Generate a public domain; you'll get a URL like{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">https://your-app.up.railway.app</code>.
          </li>
          <li>
            <strong>Build the app pointed at it.</strong> Set{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">VITE_COLLAB_SERVER=wss://your-app.up.railway.app</code>{' '}
            (note <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">wss://</code>) and run{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">npm run build</code>.
          </li>
          <li>
            <strong>Host the app on Netlify.</strong> Drop the resulting{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">dist/</code> folder onto Netlify to get a
            public HTTPS link.
          </li>
          <li>
            <strong>Share it.</strong> Send teammates the Netlify link and the board password. They open the link,
            enter the password, and they're on your board. To change the password later, just update{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">COLLAB_TOKEN</code> on Railway - everyone is
            re-prompted for the new one.
          </li>
        </ol>
        <p>
          Because you run the server, your board's data lives on infrastructure you control - the app's developer
          has no server and no access to it.
        </p>
      </Chapter>
    </div>
  )
}
