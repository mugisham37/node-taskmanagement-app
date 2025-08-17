import type { NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

// Store
import { useAppSelector } from '@/store'
import { selectIsAuthenticated } from '@/store/slices/authSlice'

// Components
import { LandingPage } from '@/components/pages/LandingPage'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// Config
import { appConfig } from '@/config/app'

const Home: NextPage = () => {
  const router = useRouter()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, router])

  // Show loading while checking authentication
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{appConfig.name} - Modern Task Management</title>
        <meta
          name="description"
          content="Streamline your workflow with our modern task management application. Organize projects, collaborate with teams, and boost productivity."
        />
        <meta name="keywords" content="task management, productivity, project management, collaboration, workflow" />
        
        {/* Open Graph */}
        <meta property="og:title" content={`${appConfig.name} - Modern Task Management`} />
        <meta
          property="og:description"
          content="Streamline your workflow with our modern task management application. Organize projects, collaborate with teams, and boost productivity."
        />
        
        {/* Twitter */}
        <meta name="twitter:title" content={`${appConfig.name} - Modern Task Management`} />
        <meta
          name="twitter:description"
          content="Streamline your workflow with our modern task management application. Organize projects, collaborate with teams, and boost productivity."
        />
        
        {/* Canonical URL */}
        <link rel="canonical" href={appConfig.appUrl} />
        
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: appConfig.name,
              description: appConfig.description,
              url: appConfig.appUrl,
              applicationCategory: 'ProductivityApplication',
              operatingSystem: 'Web Browser',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              author: {
                '@type': 'Organization',
                name: 'Task Management Team',
              },
            }),
          }}
        />
      </Head>

      <LandingPage />
    </>
  )
}

export default Home