import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | TCGMaster',
  description:
    'Terms and conditions for using TCGMaster services.',
  openGraph: {
    title: 'Terms of Service | TCGMaster',
    description:
      'Terms and conditions for using TCGMaster services.',
    type: 'website',
    siteName: 'TCGMaster',
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container py-16">
        <div className="max-w-3xl mx-auto prose prose-zinc">
          <h1>Terms of Service</h1>

          <p className="text-zinc-500">Last Updated: January 2026</p>

          <p>
            Welcome to TCGMaster. These Terms of Service (&quot;Terms&quot;) govern your use
            of our website and services. By accessing or using TCGMaster, you agree to be
            bound by these Terms.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account or using our services, you acknowledge that you have read,
            understood, and agree to be bound by these Terms. If you do not agree to these
            Terms, please do not use our services.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            TCGMaster provides a platform for tracking trading card prices, managing
            collections, and accessing market analytics. Our services include:
          </p>
          <ul>
            <li>Price tracking and historical data</li>
            <li>Collection management tools</li>
            <li>Price alerts and notifications</li>
            <li>Portfolio analytics</li>
          </ul>

          <h2>3. Account Registration</h2>
          <p>To access certain features, you must create an account. You agree to:</p>
          <ul>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized access</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>

          <h2>4. User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any part of the service</li>
            <li>Interfere with the proper working of the service</li>
            <li>Scrape, crawl, or use automated means to access the service</li>
            <li>Upload viruses or malicious code</li>
            <li>Impersonate any person or entity</li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <p>
            All content on TCGMaster, including text, graphics, logos, and software, is the
            property of TCGMaster or its licensors and is protected by intellectual property
            laws. You may not reproduce, distribute, or create derivative works without our
            express permission.
          </p>

          <h2>6. Price Data Disclaimer</h2>
          <p>
            Price data provided on TCGMaster is for informational purposes only. We do not
            guarantee the accuracy, completeness, or timeliness of any price information.
            Prices may vary from actual market values, and past performance is not indicative
            of future results.
          </p>
          <p>
            <strong>
              TCGMaster is not a financial advisor. Any investment decisions should be made
              based on your own research and judgment.
            </strong>
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, TCGMaster shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages resulting from
            your use of the service, including but not limited to:
          </p>
          <ul>
            <li>Loss of profits or anticipated savings</li>
            <li>Loss of data or goodwill</li>
            <li>Service interruptions</li>
            <li>Computer damage or system failures</li>
          </ul>

          <h2>8. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless TCGMaster and its officers, directors,
            employees, and agents from any claims, damages, losses, or expenses arising from
            your use of the service or violation of these Terms.
          </p>

          <h2>9. Modifications to Service</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue the service at any time
            without notice. We shall not be liable to you or any third party for any
            modification, suspension, or discontinuance.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We may revise these Terms at any time by updating this page. Your continued use
            of the service after any changes constitutes acceptance of the new Terms.
          </p>

          <h2>11. Termination</h2>
          <p>
            We may terminate or suspend your account at any time, without prior notice, for
            conduct that we believe violates these Terms or is harmful to other users,
            TCGMaster, or third parties.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the
            United States, without regard to its conflict of law provisions.
          </p>

          <h2>13. Contact Information</h2>
          <p>
            If you have any questions about these Terms, please contact us at{' '}
            <a href="mailto:legal@tcgmaster.com">legal@tcgmaster.com</a>.
          </p>

          <hr />

          <h2>Disclaimer</h2>
          <p className="text-sm text-zinc-500">
            TCGMaster is not affiliated with, endorsed by, or sponsored by The Pokemon
            Company, Nintendo, Topps, Panini, Upper Deck, or any other trading card
            manufacturer or grading company. All trademarks, logos, and brand names are the
            property of their respective owners. Card images are used for identification
            purposes only.
          </p>
        </div>
      </div>
    </div>
  );
}
