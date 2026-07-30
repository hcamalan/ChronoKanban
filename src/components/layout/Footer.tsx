export function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <p>
        ChronoKanban by{' '}
        <a
          href="https://hcamalan.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700 dark:hover:text-gray-200"
        >
          Hüseyin Camalan
        </a>{' '}
        ·{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700 dark:hover:text-gray-200"
        >
          CC BY 4.0
        </a>{' '}
        ·{' '}
        <a href="./privacy.html" className="underline hover:text-gray-700 dark:hover:text-gray-200">
          Privacy Policy
        </a>
      </p>
    </footer>
  )
}
