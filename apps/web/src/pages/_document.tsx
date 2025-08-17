import { appConfig } from '@/config/app'
import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="h-full">
      <Head>
        {/* Meta tags */}
        <meta charSet="utf-8" />
        <meta name="description" content={appConfig.description} />
        <meta name="author" content="Task Management Team" />
        <meta name="robots" content="index,follow" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Theme color */}
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="msapplication-TileColor" content="#0ea5e9" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={appConfig.name} />
        <meta property="og:description" content={appConfig.description} />
        <meta property="og:url" content={appConfig.appUrl} />
        <meta property="og:site_name" content={appConfig.name} />
        <meta property="og:image" content={`${appConfig.appUrl}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={appConfig.name} />
        <meta name="twitter:description" content={appConfig.description} />
        <meta name="twitter:image" content={`${appConfig.appUrl}/og-image.png`} />
        
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* DNS prefetch */}
        <link rel="dns-prefetch" href={appConfig.apiUrl} />
        
        {/* Preload critical resources */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap"
          as="style"
          onLoad="this.onload=null;this.rel='stylesheet'"
        />
        
        {/* Security headers via meta tags */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        
        {/* PWA meta tags */}
        <meta name="application-name" content={appConfig.name} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appConfig.name} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Viewport for mobile */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        
        {/* Analytics */}
        {appConfig.services.analytics.enabled && appConfig.services.analytics.id && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${appConfig.services.analytics.id}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${appConfig.services.analytics.id}', {
                    page_title: document.title,
                    page_location: window.location.href,
                  });
                `,
              }}
            />
          </>
        )}
        
        {/* Error reporting */}
        {appConfig.services.sentry.dsn && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.SENTRY_DSN = '${appConfig.services.sentry.dsn}';
                window.SENTRY_ENVIRONMENT = '${appConfig.services.sentry.environment}';
              `,
            }}
          />
        )}
      </Head>
      <body className="h-full bg-gray-50 dark:bg-gray-900 antialiased">
        <Main />
        <NextScript />
        
        {/* No-script fallback */}
        <noscript>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f9fafb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            padding: '2rem',
          }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#111827' }}>
              JavaScript Required
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#6b7280', maxWidth: '32rem' }}>
              This application requires JavaScript to function properly. 
              Please enable JavaScript in your browser settings and reload the page.
            </p>
          </div>
        </noscript>
      </body>
    </Html>
  )
}