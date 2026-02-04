import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | TCGMaster',
  description:
    'Learn how TCGMaster collects, uses, and protects your personal information.',
  openGraph: {
    title: 'Privacy Policy | TCGMaster',
    description:
      'Learn how TCGMaster collects, uses, and protects your personal information.',
    type: 'website',
    siteName: 'TCGMaster',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container py-16">
        <div className="max-w-3xl mx-auto prose prose-zinc">
          <h1>Privacy Policy</h1>

          <p className="text-zinc-500">Last Updated: January 2026</p>

          <p>
            At TCGMaster, we take your privacy seriously. This Privacy Policy explains how we
            collect, use, disclose, and safeguard your information when you visit our website
            and use our services.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Personal Information</h3>
          <p>When you create an account or use our services, we may collect:</p>
          <ul>
            <li>Name and email address</li>
            <li>Account credentials</li>
            <li>Payment information (processed securely through third-party providers)</li>
            <li>Collection data you choose to add</li>
          </ul>

          <h3>Automatically Collected Information</h3>
          <p>When you visit our website, we automatically collect:</p>
          <ul>
            <li>IP address and device information</li>
            <li>Browser type and version</li>
            <li>Pages visited and time spent</li>
            <li>Referring website addresses</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide and maintain our services</li>
            <li>Process transactions and send related information</li>
            <li>Send you price alerts and notifications you request</li>
            <li>Respond to your comments and questions</li>
            <li>Analyze usage patterns to improve our services</li>
            <li>Detect and prevent fraud and abuse</li>
          </ul>

          <h2>3. Cookies and Tracking</h2>
          <p>
            We use cookies and similar tracking technologies to track activity on our website
            and hold certain information. You can instruct your browser to refuse all cookies
            or to indicate when a cookie is being sent.
          </p>

          <h2>4. Third-Party Services</h2>
          <p>We may employ third-party companies to facilitate our service, including:</p>
          <ul>
            <li>Analytics providers (e.g., PostHog)</li>
            <li>Payment processors</li>
            <li>Email service providers</li>
            <li>Cloud hosting services</li>
          </ul>
          <p>
            These third parties have access to your information only to perform specific tasks
            on our behalf and are obligated not to disclose or use it for any other purpose.
          </p>

          <h2>5. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal information.
            However, no method of transmission over the Internet is 100% secure. While we
            strive to use commercially acceptable means to protect your data, we cannot
            guarantee its absolute security.
          </p>

          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to processing of your data</li>
            <li>Request data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>

          <h2>7. Children&apos;s Privacy</h2>
          <p>
            Our services are not intended for children under 13 years of age. We do not
            knowingly collect personal information from children under 13.
          </p>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any
            changes by posting the new Privacy Policy on this page and updating the
            &quot;Last Updated&quot; date.
          </p>

          <h2>9. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:privacy@tcgmaster.com">privacy@tcgmaster.com</a>.
          </p>

          <hr />

          <h2>Disclaimer</h2>
          <p className="text-sm text-zinc-500">
            TCGMaster is not affiliated with, endorsed by, or sponsored by The Pokemon
            Company, Nintendo, Topps, Panini, Upper Deck, or any other trading card
            manufacturer or grading company. All trademarks, logos, and brand names are the
            property of their respective owners.
          </p>
        </div>
      </div>
    </div>
  );
}
