import { Fragment } from "react"
import { PublicShell } from "@/components/public-shell"

/**
 * Legal document pages (TZ §11): /privacy, /terms, /refund.
 * Bodies are lightweight markdown: `## `/`### ` headings, `- ` bullet lists,
 * `_.._` for the muted footer line, blank line = new block. URLs and emails
 * are auto-linked.
 */

const PRIVACY_BODY = `
Last updated: July 3, 2026

This Privacy Policy explains how Level Up ("we", "us", "the Bot") collects, uses, and protects information when you use our Discord bot service.

By adding Level Up to your Discord server or interacting with the Bot, you agree to the terms of this Privacy Policy.

## 1. Information We Collect

We collect the following data through the Discord API when you use Level Up:

### Discord Account Data

- User ID
- Username and display name
- Avatar
- Server (guild) IDs where the Bot is present
- Role IDs and permissions on those servers
- Channel IDs where the Bot operates

### Interaction Data

- Messages sent in servers where the Bot is active (processed in real time for features such as welcome messages, message templates, moderation, and leveling)
- Reactions added to messages (for reaction roles)
- Voice channel join and leave events (for voice XP)
- Member join and leave events

### Third-Party Integration Data

- Twitch account ID and username (only when a user or server admin connects Twitch integration)
- Stream status events from Twitch

### Subscription and Payment Data

- Email address (for subscription communication)
- Subscription status, plan, and billing dates

Payment card information is processed directly by Stripe, Inc. We do not store or have access to your payment card details.

### Technical Data

- IP addresses (for security and abuse prevention)
- Timestamps of interactions with the Bot
- Cookies used to keep you logged in to the dashboard

## 2. How We Use Your Information

We use collected data to:

- Provide the Bot's features (welcome messages, moderation, leveling, message templates, reaction roles, Twitch notifications, server logs)
- Process and manage subscriptions
- Prevent abuse, spam, and security threats
- Respond to support requests
- Improve the Bot based on aggregated usage patterns

We do not sell your data to third parties. We do not use your data for advertising. We do not share data with any party not listed in Section 4.

## 3. Message Content

Level Up requires the Message Content privileged intent to provide features such as message templates, moderation, and custom commands.

Message content is processed in real time and is not stored permanently in our database, except:

- Message templates you explicitly save through the dashboard
- Server logs, if enabled by a server administrator

We do not read private direct messages. We do not use message content to train AI models. We do not share message content with third parties.

## 4. Third-Party Services

We share limited data with the following third parties strictly to provide the Bot service:

- Discord Inc. — https://discord.com/privacy
- Stripe, Inc. — https://stripe.com/privacy
- Twitch Interactive, Inc. — https://www.twitch.tv/p/legal/privacy-notice/

## 5. Data Retention

We retain data only as long as necessary to provide the Service:

- Server and user data (Discord IDs, XP, settings, templates, logs): deleted within 30 days after the Bot is removed from a server
- Subscription and transaction records: retained for 7 years to comply with US tax and accounting laws
- Message content: not stored permanently, as described in Section 3

## 6. Your Rights

You have the right to:

- Access the data we hold about you
- Request correction of inaccurate data
- Request deletion of your data
- Object to processing of your data
- Withdraw consent at any time

To exercise these rights, contact us at the email listed in Section 10.

If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, you have additional rights under the General Data Protection Regulation (GDPR), including the right to data portability and the right to lodge a complaint with your local data protection authority.

If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to request deletion, and the right to opt out of the sale of personal information. We do not sell personal information.

## 7. Children's Privacy

Level Up is not intended for users under 13 years of age, in line with Discord's Terms of Service. We do not knowingly collect data from children under 13.

If you believe we have collected data from a child, please contact us and we will delete it.

## 8. Security

We use reasonable measures to protect your data. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the Bot after changes constitutes acceptance.

## 10. Contact

Questions or requests about this Privacy Policy:

Email: lvlup.studio.off@gmail.com

Discord support server: https://discord.gg/c55pxXKAtp

_Level Up is an independent service and is not affiliated with, endorsed by, or sponsored by Discord Inc., Twitch Interactive, or Stripe, Inc._
`

const TERMS_BODY = `
Last updated: July 3, 2026

These Terms of Service ("Terms") govern your use of Level Up ("Bot", "Service", "we", "us"). By adding the Bot to a Discord server or using its features, you agree to these Terms.

If you do not agree with these Terms, you must not use the Bot.

## 1. Eligibility

You must be at least 13 years old to use Level Up, in line with Discord's Terms of Service. In the European Union, the minimum age may be higher depending on your country's law (typically 16).

By using the Bot, you confirm you meet this age requirement and have the authority to add the Bot to any server you manage.

## 2. What the Bot Does

Level Up provides Discord server management features including but not limited to:

- Message templates and custom messages
- Welcome, goodbye, and returning member messages
- Leveling system (chat and voice XP)
- Reaction roles
- Server logs
- Twitch integration and stream notifications
- Moderation tools

Feature availability depends on your subscription tier (Free or Premium). Feature set may change over time.

## 3. Acceptable Use

You agree NOT to:

- Use the Bot to violate Discord's Terms of Service or Community Guidelines
- Use the Bot for harassment, hate speech, or illegal content
- Attempt to reverse engineer, decompile, or exploit the Bot
- Bypass subscription limits or premium feature restrictions
- Use the Bot for automated spam, scraping, or mass messaging outside its intended features
- Impersonate the Bot, our staff, or other users
- Use the Bot in servers that violate applicable law

We reserve the right to remove the Bot from any server and terminate access without notice for violations.

## 4. Subscriptions and Payments

### 4.1 Free Tier

Basic features of Level Up are available at no cost. We commit to never moving currently free features to paid tiers.

### 4.2 Premium Subscription

Premium features are available via monthly subscription at the current advertised price. Subscriptions are per-server: each Discord server requires its own subscription.

### 4.3 Billing

Payments are processed by Stripe, Inc. Subscriptions auto-renew at the end of each billing period until cancelled.

### 4.4 Cancellation

You may cancel your subscription at any time through the Bot's dashboard. Cancellation takes effect at the end of the current billing period, and you will retain Premium access until that date.

### 4.5 Price Changes

We may change subscription prices with at least 30 days notice. Existing subscribers keep their current price until they cancel or the subscription lapses.

### 4.6 Failed Payments

If a payment fails, you have a 7-day grace period to update your payment method. After that, the server automatically reverts to Free tier. Existing configurations are preserved and will be reactivated when the subscription resumes.

## 5. Refunds

Refund requests are handled per our separate Refund Policy, available on our website.

## 6. Intellectual Property

The Bot, its code, name, logo, branding, and design are our property. You may not copy, modify, distribute, or create derivative works without our written permission.

Content you create within the Bot (message templates, welcome messages, custom configurations) remains yours. You grant us a limited license to store and process this content solely to provide the Service.

## 7. Third-Party Services

Level Up integrates with Discord, Stripe, and Twitch. Your use of these integrations is also subject to their respective terms of service.

We are not responsible for the availability, functionality, or policies of these third-party services. Service interruptions caused by these platforms are outside our control.

## 8. Disclaimer of Warranties

The Bot is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, or non-infringement.

We do not warrant that the Bot will be uninterrupted, error-free, or completely secure.

## 9. Limitation of Liability

To the maximum extent permitted by law, we are not liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Bot.

Our total liability for any claim relating to the Bot shall not exceed the total amount you paid to us in the 12 months preceding the claim.

## 10. Indemnification

You agree to indemnify and hold harmless Level Up and its operator from any claims, damages, or expenses arising from your violation of these Terms or your misuse of the Bot.

## 11. Termination

You may stop using the Bot at any time by removing it from your server.

We may terminate or suspend your access without notice for violations of these Terms, illegal activity, or abuse. Upon termination, your data is deleted per our Privacy Policy retention schedule.

## 12. Governing Law

These Terms are governed by the laws of the State of Illinois, United States, without regard to conflict of law principles.

Any disputes shall be resolved in the state or federal courts located in Illinois.

## 13. Changes to These Terms

We may update these Terms from time to time. Material changes will be announced at least 30 days in advance via our website or Discord support server. Continued use of the Bot after changes constitutes acceptance of the updated Terms.

## 14. Not Affiliated with Discord

Level Up is an independent service and is not affiliated with, endorsed by, or sponsored by Discord Inc., Twitch Interactive, or Stripe, Inc.

## 15. Contact

Questions about these Terms:

Email: lvlup.studio.off@gmail.com

Discord support server: https://discord.gg/c55pxXKAtp

_By using Level Up, you acknowledge that you have read, understood, and agreed to these Terms of Service._
`

const REFUND_BODY = `
Last updated: July 3, 2026

This Refund Policy describes how Level Up ("we", "us", "the Bot") handles refund requests for Premium subscriptions. It provides the framework for decisions made on refund requests but does not constitute a legal guarantee.

Every refund request is reviewed individually. We reserve the right to approve or deny any refund at our discretion, based on the circumstances described below.

## 1. Possible Reasons for a Refund

The following situations may qualify for a full or partial refund:

- An unauthorized transaction was made without your consent that financially affected you
- You did not receive or cannot access the promised Premium features due to a fault on our side
- A technical failure on our side prevented you from using paid features for a significant portion of the billing period

All refund requests require supporting evidence (screenshots, transaction IDs, error descriptions) to be considered.

## 2. Non-Qualifying Requests

Refunds will NOT be issued in the following situations:

- You forgot to cancel your subscription before the automatic renewal
- You no longer wish to use the Bot after having used Premium features during the billing period
- Change of mind after the subscription has been active
- Downtime or issues caused by Discord, Stripe, Twitch, or other third-party services outside our control
- You were removed from the Service due to a violation of our Terms of Service
- Any other request without reasonable justification

## 3. Chargebacks

Initiating a chargeback through your payment provider (Stripe or your bank) without first contacting us will result in immediate and permanent termination of your access to the Service.

We strongly encourage you to reach out to us before disputing a charge — most issues can be resolved directly through our support channels.

## 4. EU Customers — Right of Withdrawal

If you are a consumer located in the European Union, you have the right to withdraw from a purchase within 14 days of subscribing, under EU consumer law.

However, by subscribing and immediately gaining access to Premium features, you expressly consent to the immediate performance of the Service and acknowledge that you lose your right of withdrawal once the Service has been provided.

This waiver is required to activate your subscription and begin using Premium features.

## 5. How to Request a Refund

To request a refund, contact us via email with the following information:

- Your Discord user ID
- The server (guild) ID where the subscription was active
- Transaction ID from Stripe (receipt or invoice number)
- Reason for the refund request, with any supporting evidence

We will review your request and respond within 7 business days.

## 6. Approved Refunds

If your refund is approved:

- The refund will be issued to the original payment method through Stripe
- Processing time is typically 5–10 business days, depending on your bank or card issuer
- Premium access to the server will be revoked at the time of refund
- Existing server configurations will be preserved and reactivated if a new subscription is purchased later

## 7. Changes to This Policy

We may update this Refund Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. The version in effect at the time of your purchase applies to that specific transaction.

## 8. Contact

Questions or refund requests:

Email: lvlup.studio.off@gmail.com

Discord support server: https://discord.gg/c55pxXKAtp

_Please contact us respectfully and be patient — we handle each refund request individually and aim to resolve concerns fairly._
`

const PLACEHOLDER = "The full document will be published here shortly."

const LINK_RE = /(https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g

/** Turn plain URLs and emails into links; everything else passes through. */
function Linkify({ text }: { text: string }) {
  const parts = text.split(LINK_RE)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pub-accent, #a78bfa)" }}>
              {part}
            </a>
          )
        }
        if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(part)) {
          return (
            <a key={i} href={`mailto:${part}`} style={{ color: "var(--pub-accent, #a78bfa)" }}>
              {part}
            </a>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

function LegalBlock({ block }: { block: string }) {
  if (block.startsWith("### ")) {
    return (
      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 17,
          color: "var(--pub-ink, #fff)",
          marginTop: 8,
        }}
      >
        {block.slice(4)}
      </h3>
    )
  }
  if (block.startsWith("## ")) {
    return (
      <h2
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 22,
          color: "var(--pub-ink, #fff)",
          marginTop: 20,
        }}
      >
        {block.slice(3)}
      </h2>
    )
  }
  const lines = block.split("\n")
  if (lines.every((l) => l.startsWith("- "))) {
    return (
      <ul style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
        {lines.map((l, i) => (
          <li key={i} style={{ listStyle: "disc" }}>
            <Linkify text={l.slice(2)} />
          </li>
        ))}
      </ul>
    )
  }
  if (block.startsWith("_") && block.endsWith("_")) {
    return (
      <p style={{ fontStyle: "italic", opacity: 0.7, marginTop: 16, textAlign: "center" }}>
        <Linkify text={block.slice(1, -1)} />
      </p>
    )
  }
  return (
    <p>
      <Linkify text={block} />
    </p>
  )
}

function LegalPage({ title, body }: { title: string; body: string }) {
  const blocks = body.trim() ? body.trim().split(/\n{2,}/) : [PLACEHOLDER]
  return (
    <PublicShell>
      <div className="public-wrap" style={{ padding: "80px 28px", maxWidth: 860 }}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(28px, 4vw, 40px)",
            marginBottom: 28,
          }}
        >
          {title}
        </h1>
        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 15.5,
            lineHeight: 1.75,
            color: "var(--pub-ink-soft)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {blocks.map((b, i) => (
            <LegalBlock key={i} block={b} />
          ))}
        </div>
      </div>
    </PublicShell>
  )
}

export function PrivacyPage() {
  return <LegalPage title="Privacy Policy" body={PRIVACY_BODY} />
}

export function TermsPage() {
  return <LegalPage title="Terms of Service" body={TERMS_BODY} />
}

export function RefundPage() {
  return <LegalPage title="Refund Policy" body={REFUND_BODY} />
}
