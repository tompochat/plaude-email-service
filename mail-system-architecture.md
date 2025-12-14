# ySocial Mail System Architecture - Complete Technical Documentation

This document provides a comprehensive explanation of how the ySocial application handles email (MAIL) functionality, including configuration, polling, message processing, sending responses, and all components involved. This guide is designed to help you replicate this logic in a smaller Next.js project.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Key Components](#key-components)
4. [Configuration System](#configuration-system)
5. [Polling Mechanism (Receiving Emails)](#polling-mechanism-receiving-emails)
6. [Message Processing Pipeline](#message-processing-pipeline)
7. [Sending Responses](#sending-responses)
8. [Data Persistence](#data-persistence)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [Step-by-Step Flow](#step-by-step-flow)
11. [Replicating in Next.js](#replicating-in-nextjs)

---

## 1. Overview

The ySocial Mail system is an enterprise-grade email processing system that:

- **Polls** email servers (IMAP, POP3, EWS, Gmail) at configurable intervals
- **Converts** incoming emails to a unified internal message format
- **Persists** messages to a database
- **Notifies** frontend users in real-time via SignalR
- **Sends** replies back through SMTP or EWS
- **Tracks** conversation threads using email headers (In-Reply-To, References)

### Supported Protocols

| Protocol | Receive | Send | Use Case |
|----------|---------|------|----------|
| IMAP | ✅ | ❌ | Standard email retrieval |
| POP3 | ✅ | ❌ | Legacy email retrieval |
| SMTP | ❌ | ✅ | Standard email sending |
| EWS (Exchange Web Services) | ✅ | ✅ | Microsoft Exchange/Office 365 |
| Gmail OAuth | ✅ | ✅ | Google Workspace with OAuth |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIL SYSTEM ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Mail Servers   │     │   Mail Servers   │     │   Mail Servers   │
│   (IMAP/POP3)    │     │   (Exchange/EWS) │     │   (Gmail OAuth)  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │    POLLING SERVICE       │
                    │  (Windows Service/Timer) │
                    │  Interval: 35 seconds    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │     MAIL SERVICE         │
                    │    (MailService.cs)      │
                    │ ┌──────────────────────┐ │
                    │ │ QueryIMAP()          │ │
                    │ │ QueryPOP3()          │ │
                    │ │ QueryEWS()           │ │
                    │ └──────────────────────┘ │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │      CONVERTER           │
                    │   (MimeKit → Message)    │
                    │ • Parse headers          │
                    │ • Extract body           │
                    │ • Process attachments    │
                    │ • Map sender to user     │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │      MESSAGE DAO         │
                    │   (Database Insert)      │
                    │ • Create/Update Case     │
                    │ • Link to Thread         │
                    │ • Store Attachments      │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
        ┌──────────────────┐     ┌──────────────────┐
        │   WEB FRONTEND   │     │    SIGNALR       │
        │   (Agent UI)     │◄────│  (Real-time)     │
        └────────┬─────────┘     └──────────────────┘
                 │
                 │ Agent writes reply
                 ▼
        ┌──────────────────┐
        │  AZURE SERVICE   │
        │      BUS         │
        │  (Reply Queue)   │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │   MAIL SERVICE   │
        │    Reply()       │
        │ ┌──────────────┐ │
        │ │ SendSMTP()   │ │
        │ │ SendEWS()    │ │
        │ └──────────────┘ │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │   MAIL SERVER    │
        │   (Outgoing)     │
        └──────────────────┘
```

---

## 3. Key Components

### 3.1 Core Files and Their Responsibilities

| File | Purpose |
|------|---------|
| `MailService.cs` | Main service class implementing polling, sending, and receiving |
| `MailServiceConfiguration.cs` | Configuration container for the mail service |
| `MailRetrieveConfiguration.cs` | Base class for incoming mail configuration |
| `MailRetrieveConfigurationIMAP.cs` | IMAP-specific configuration |
| `MailRetrieveConfigurationPOP3.cs` | POP3-specific configuration |
| `MailRetrieveConfigurationEWS.cs` | Exchange Web Services configuration |
| `MailRetrieveConfigurationGmail.cs` | Gmail OAuth configuration |
| `MailSendConfiguration.cs` | Base class for outgoing mail configuration |
| `MailSendConfigurationSMTP.cs` | SMTP-specific configuration |
| `Converter.cs` | Converts MimeKit messages to internal Message format |
| `MailMessage.cs` | Mail-specific message entity extending base Message |
| `Service.cs` | Windows service with timer-based polling loop |
| `MailSettings.cs` | Service-level behavior settings |

### 3.2 Libraries Used

- **MailKit** (v4.x): IMAP, POP3, SMTP client library
- **MimeKit** (v4.x): MIME message parsing and creation
- **Microsoft.Exchange.WebServices** (EWS Managed API): Exchange integration
- **Google.Apis.Auth**: Gmail OAuth authentication
- **EAGetMail**: TNEF (winmail.dat) attachment parsing

---

## 4. Configuration System

### 4.1 Service Configuration Structure

The mail configuration is stored as JSON and deserialized into a `MailServiceConfiguration` object:

```typescript
// Equivalent TypeScript interface
interface MailServiceConfiguration {
  connectionType: 'ImapSmtp' | 'Pop3Smtp' | 'EWS' | 'Gmail';
  emailAddress: string;
  displayName: string;
  mailAddressForReplyTo?: string;
  fromDate: Date;  // Only process emails after this date
  editSubject?: string;  // Template for modifying subject (e.g., "RE: @@ASUNTO@@")
  mailDeliveryErrorFrom?: string;  // Address to ignore (bounce notifications)
  
  retrieveConfig: MailRetrieveConfiguration;
  sendConfig: MailSendConfiguration;
}
```

### 4.2 Retrieve Configuration (Incoming)

#### IMAP Configuration
```typescript
interface MailRetrieveConfigurationIMAP {
  protocol: 'IMAP';
  server: string;
  port: number;
  useSSL: boolean;
  secureOptions: 'None' | 'Auto' | 'SslOnConnect' | 'StartTls' | 'StartTlsWhenAvailable';
  username: string;
  password: string;  // Encrypted in storage
  
  // Behavior settings
  setMailsAsRead: boolean;
  setMailsAsDeleted: boolean;
  useReceivedDateInsteadOfSentDate: boolean;
  useReceivedDateIfSentDateIsInTheFuture: boolean;
  daysUntilMailsAreDeleted?: number;
}
```

#### EWS Configuration
```typescript
interface MailRetrieveConfigurationEWS {
  protocol: 'EWS';
  server: string;  // e.g., "https://outlook.office365.com/EWS/Exchange.asmx"
  timeout: number;  // in seconds
  version?: 'Exchange2007_SP1' | 'Exchange2010' | 'Exchange2013' | 'Exchange2016';
  
  // Authentication
  authenticationType: 'Basic' | 'OAuth';
  username?: string;
  password?: string;
  
  // OAuth settings (for Microsoft 365)
  oauthAppID?: string;
  oauthClientSecret?: string;
  oauthTenantID?: string;
  oauthEmailAddress?: string;
}
```

#### Gmail Configuration
```typescript
interface MailRetrieveConfigurationGmail {
  protocol: 'Gmail';
  username: string;  // The Gmail address
  jsonCredentials: string;  // Service account JSON key file contents
}
```

### 4.3 Send Configuration (Outgoing)

#### SMTP Configuration
```typescript
interface MailSendConfigurationSMTP {
  protocol: 'SMTP';
  server: string;
  port: number;
  useSSL: boolean;
  secureOptions: 'None' | 'Auto' | 'SslOnConnect' | 'StartTls';
  useCredentials: boolean;
  username?: string;
  password?: string;
  
  // Quote settings
  usePreviousQuotes: boolean;  // Include original message in reply
  quoteType?: 'Standard' | 'Outlook' | 'Gmail';
}
```

### 4.4 Service Settings (Behavior)

```typescript
interface MailSettings {
  // Case handling
  caseHandling: 'CreateOneByThread' | 'CreateOne';
  
  // Signature
  useSignature: boolean;
  signatureBehaviour: 'None' | 'AutoInsert' | 'InsertWhenReplyingAndAllowEdit' | 'InsertWhenReplyingReadOnly';
  signature: string;  // HTML signature content
  queuePriority: boolean;  // Use queue-specific signature over service signature
  
  // UI features
  useCC: boolean;
  useBCC: boolean;
  allowToEditSubject: boolean;
  fontChangesAvailable: boolean;
  answersFontType: number;
  answersFontSize: number;
  
  // Filtering
  ignoreXFailedRecipients: boolean;  // Ignore bounce-back emails
  ignoreMultipartReport: boolean;  // Ignore delivery reports
  
  // Attachments
  attachments: {
    maxAttachmentsAllowed: number;
    maxFileSizeAllowed: number;  // in bytes
    allowedExtensions: string[];
  };
  
  // Inactivity monitoring
  minutesForInactivity: number;
  inactivityDetected: EmailSettings;  // Alert email config
  authenticationErrorOcurred: EmailSettings;
}
```

---

## 5. Polling Mechanism (Receiving Emails)

### 5.1 Timer-Based Polling

The system uses a Windows Service with a timer that fires every N milliseconds (default: 35000ms = 35 seconds):

```csharp
// Service.cs - Initialization
timer = new System.Threading.Timer(
    async (c) => { await DoWork(); }, 
    null, 
    5000,  // Initial delay
    this.refreshInterval  // Repeat interval (35 seconds default)
);
```

### 5.2 Polling Flow (DoWork Method)

```
DoWork()
│
├── 1. Stop timer to prevent overlapping executions
│
├── 2. Verify license is valid
│
├── 3. Refresh system settings from database
│
├── 4. Load blocked users list
│
├── 5. For each configured service:
│   │
│   ├── ReconfigureService() - Check for configuration changes
│   │
│   └── QueryService() - Poll for new messages
│       │
│       ├── Skip if service disabled
│       │
│       ├── Skip if service doesn't support polling (webhook-based)
│       │
│       ├── Skip if ValidUntil date has passed
│       │
│       ├── Create CancellationToken (10 minute timeout)
│       │
│       └── await socialService.Query(token)
│
└── 6. Restart timer
```

### 5.3 Protocol-Specific Query Methods

#### 5.3.1 IMAP Query Flow

```typescript
// Pseudocode for QueryIMAP()
async function queryIMAP(): Promise<Message[]> {
  const messages: Message[] = [];
  
  // 1. Connect to IMAP server
  const client = new ImapClient();
  await client.connect(config.server, config.port, config.secureOptions);
  await client.authenticate(config.username, config.password);
  
  // 2. Open inbox
  await client.inbox.open(FolderAccess.ReadWrite);
  
  // 3. Search for unread messages
  const messageIds = await client.inbox.search(
    SearchQuery.NotSeen.AND(SearchQuery.DeliveredAfter(config.fromDate))
  );
  
  // 4. Track last processed message ID (for incremental fetch)
  let lastMailId = status.get('LastMailId') || UniqueId.MinValue;
  
  // 5. Process each message (limit to 20 per iteration)
  for (const id of messageIds.slice(0, 20)) {
    if (id < lastMailId) continue;  // Already processed
    
    const mimeMessage = await client.inbox.getMessage(id);
    
    // 6. Should we ignore this message?
    if (await shouldIgnore(mimeMessage)) continue;
    
    // 7. Convert to internal format
    const message = Converter.convert(mimeMessage, id.toString(), config);
    
    // 8. Check if user is blocked
    if (isSocialUserBlocked(message.postedBy)) continue;
    
    // 9. Detect if it's our own reply (outgoing)
    if (mimeMessage.from.address === config.emailAddress) {
      message.isReply = true;
    }
    
    messages.push(message);
    lastMailId = id;
  }
  
  // 10. Mark messages as read/deleted if configured
  if (config.setMailsAsRead || config.setMailsAsDeleted) {
    await client.inbox.addFlags(processedIds, flags);
  }
  
  // 11. Delete old messages if configured
  if (config.daysUntilMailsAreDeleted) {
    await deleteOldMails(client, config.daysUntilMailsAreDeleted);
  }
  
  // 12. Save state
  status.set('LastMailId', lastMailId.toString());
  
  return messages;
}
```

#### 5.3.2 EWS Query Flow

```typescript
// Pseudocode for QueryEWS()
async function queryEWS(): Promise<Message[]> {
  const messages: Message[] = [];
  
  // 1. Connect to Exchange
  const service = new ExchangeService(config.version);
  service.url = config.server;
  
  // 2. Authenticate (Basic or OAuth)
  if (config.authenticationType === 'OAuth') {
    const token = await getOAuthToken(
      config.oauthAppID,
      config.oauthClientSecret,
      config.oauthTenantID
    );
    service.credentials = new OAuthCredentials(token);
    service.impersonatedUserId = config.oauthEmailAddress;
  } else {
    service.credentials = new WebCredentials(config.username, config.password);
  }
  
  // 3. Search for unread emails
  const filter = new SearchFilter.And(
    new SearchFilter.IsEqualTo(EmailMessageSchema.IsRead, false),
    new SearchFilter.IsGreaterThanOrEqualTo(
      EmailMessageSchema.DateTimeReceived, 
      config.fromDate
    )
  );
  
  const view = new ItemView(20);
  view.orderBy.add(ItemSchema.DateTimeReceived, SortDirection.Ascending);
  
  const results = service.findItems(WellKnownFolderName.Inbox, filter, view);
  
  // 4. Process each email
  for (const item of results) {
    // Bind to get full content
    const email = EmailMessage.bind(service, item.id, [
      BasePropertySet.FirstClassProperties,
      ItemSchema.MimeContent,
      ItemSchema.Attachments
    ]);
    
    // Convert MIME content to MimeMessage
    const mimeMessage = MimeMessage.load(email.mimeContent);
    
    if (await shouldIgnore(mimeMessage)) continue;
    
    const message = Converter.convert(mimeMessage, item.id.uniqueId, config);
    messages.push(message);
    
    // Mark as read
    item.isRead = true;
    item.update();
    
    // Optionally delete
    if (config.setMailsAsDeleted) {
      item.delete(DeleteMode.MoveToDeletedItems);
    }
  }
  
  return messages;
}
```

### 5.4 Message Ignore Criteria

Messages are ignored if any of these conditions are true:

```typescript
async function shouldIgnore(msg: MimeMessage): Promise<boolean> {
  // 1. Message is too old
  if (msg.date < config.fromDate) return true;
  
  // 2. No message ID
  if (!msg.messageId) return true;
  
  // 3. Already processed (exists in database)
  if (await MessageDAO.existsBySocialMessage(msg.messageId, 'Mail', serviceId)) {
    return true;
  }
  
  // 4. No sender information
  if (!msg.from || msg.from.length === 0) return true;
  
  // 5. Is a delivery report (if configured to ignore)
  if (config.ignoreMultipartReport) {
    if (msg.contentType?.startsWith('multipart/report')) return true;
  }
  
  // 6. Is a bounce-back (if configured to ignore)
  if (config.ignoreXFailedRecipients) {
    if (msg.headers.has('X-Failed-Recipients')) return true;
  }
  
  // 7. From delivery error address
  if (msg.from[0].address === config.mailDeliveryErrorFrom) return true;
  
  return false;
}
```

---

## 6. Message Processing Pipeline

### 6.1 Conversion Process (Converter.cs)

The `Converter.Convert()` method transforms a MimeKit message into the internal `MailMessage` format:

```typescript
function convert(
  mimeMessage: MimeMessage, 
  messageId: string, 
  config: MailServiceConfiguration
): MailMessage {
  const mailMessage = new MailMessage();
  
  // 1. Basic identifiers
  mailMessage.socialMessageID = mimeMessage.messageId;
  mailMessage.parameters['Id'] = messageId;
  
  // 2. Subject
  mailMessage.parameters['Subject'] = mimeMessage.subject;
  
  // 3. Body extraction
  if (mimeMessage.htmlBody) {
    mailMessage.body = mimeMessage.htmlBody;
    mailMessage.parameters['IsHtmlBody'] = 'true';
    mailMessage.parameters['BodyPlainText'] = htmlToText(mimeMessage.htmlBody);
  } else {
    mailMessage.body = mimeMessage.textBody;
    mailMessage.parameters['IsHtmlBody'] = 'false';
  }
  
  // 4. Date handling
  if (config.useReceivedDateInsteadOfSentDate) {
    mailMessage.date = parseReceivedDate(mimeMessage);
  } else {
    mailMessage.date = mimeMessage.date;
    // Handle future dates (clock skew)
    if (config.useReceivedDateIfSentDateIsInTheFuture && mailMessage.date > now) {
      mailMessage.date = parseReceivedDate(mimeMessage);
    }
  }
  
  // 5. Sender information
  const sender = mimeMessage.from.mailboxes[0];
  mailMessage.postedBy = await getOrCreateSocialUser(sender.address, sender.name);
  
  // 6. Recipients
  mailMessage.parameters['To'] = JSON.stringify(mimeMessage.to);
  mailMessage.parameters['Cc'] = JSON.stringify(mimeMessage.cc);
  mailMessage.parameters['Bcc'] = JSON.stringify(mimeMessage.bcc);
  
  // 7. Thread tracking
  if (mimeMessage.inReplyTo) {
    mailMessage.repliesToSocialMessageID = mimeMessage.inReplyTo;
  }
  if (mimeMessage.references.length > 0) {
    mailMessage.parameters['References'] = JSON.stringify(mimeMessage.references);
  }
  
  // 8. Headers (for debugging/advanced use)
  mailMessage.parameters['Headers'] = JSON.stringify(mimeMessage.headers);
  
  // 9. Attachments
  addAttachments(mailMessage, mimeMessage);
  
  return mailMessage;
}

function addAttachments(mailMessage: MailMessage, mimeMessage: MimeMessage) {
  const allAttachments = [
    ...mimeMessage.attachments,
    ...getInlineAttachments(mimeMessage.bodyParts),
    ...getMstnefAttachments(mimeMessage.bodyParts)  // winmail.dat
  ];
  
  if (allAttachments.length === 0) return;
  
  mailMessage.hasAttach = true;
  const inlineIndexes: Record<string, string> = {};
  
  for (let i = 0; i < allAttachments.length && i < 127; i++) {
    const attach = allAttachments[i];
    
    // Handle TNEF (winmail.dat) specially
    if (isTnef(attach)) {
      const tnefAttachments = parseTnef(attach.content);
      for (const tnefAttach of tnefAttachments) {
        mailMessage.attachments.push({
          index: i++,
          fileName: tnefAttach.name,
          mimeType: tnefAttach.mimeType,
          data: tnefAttach.content,
          isInline: false
        });
      }
    } else {
      mailMessage.attachments.push({
        index: i,
        fileName: attach.fileName || `attachment_${i}`,
        mimeType: attach.contentType.mimeType,
        data: streamToBytes(attach.content),
        isInline: attach.contentDisposition === 'inline',
        contentId: attach.contentId
      });
      
      if (attach.contentId) {
        inlineIndexes[attach.contentId] = i.toString();
      }
    }
  }
  
  mailMessage.parameters['InlineAttachmentsIndexes'] = JSON.stringify(inlineIndexes);
}
```

### 6.2 Database Insertion (InsertMessage)

```typescript
async function insertMessage(service: Service, message: MailMessage) {
  // 1. Create or update social user
  if (message.incoming) {
    await insertOrUpdateUser(message.postedBy, service);
  } else {
    message.postedBy = null;
    message.status = 'System';
  }
  
  // 2. Mark VIP users
  if (SystemSettings.markWhiteListMessagesAsVIP && message.postedBy?.vip) {
    message.important = true;
  }
  
  // 3. Set service reference
  message.service = service;
  message.serviceType = service.type;
  message.status = 'Push';  // Ready for notification
  
  // 4. Insert into database
  await MessageDAO.insertAsync(message);
  
  // 5. Store in Azure Storage (for attachments/media)
  await StorageManager.saveIncomingMessage(message);
}
```

### 6.3 Notification to Frontend

After messages are inserted, the system notifies the web application:

```typescript
async function notifySocialForNewServiceMessages(
  service: Service, 
  insertedMessageIds: number[]
) {
  const url = `${socialURL}/services/messaging/news`;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthorizationHeaders()
    },
    body: JSON.stringify({
      serviceId: service.id,
      messages: insertedMessageIds
    })
  });
}
```

---

## 7. Sending Responses

### 7.1 Reply Queue Processing

Replies are sent through Azure Service Bus for reliability:

```typescript
// ProcessMessagesAsync - handles reply queue messages
async function processReplyMessage(args: ProcessMessageEventArgs) {
  const body = JSON.parse(args.message.body);
  const messageId = body.messageId;
  
  // 1. Load the message with all related data
  const message = await MessageDAO.getOne(messageId, {
    repliesTo: true,
    attachments: true,
    repliedBy: true,
    repliesToSocialUser: true,
    queue: true
  });
  
  if (!message) return;
  
  // 2. Check authorization
  if (message.requiresAuthorization && !message.authorized) return;
  
  // 3. Check retry limit
  if (message.deliveryRetries >= SystemSettings.maxRetries) return;
  
  // 4. Send via appropriate protocol
  const socialService = services.get(message.service.id);
  const sentMessageId = await socialService.reply(message);
  
  // 5. Update database with sent message ID
  await MessageDAO.updateSocialMessage(message.id, sentMessageId, message.parameters);
}
```

### 7.2 Reply Method (MailService.Reply)

```typescript
async function reply(message: Message): Promise<string> {
  // 1. Create MimeMessage
  const mimeMessage = new MimeMessage();
  
  // 2. Set From
  mimeMessage.from.add(new MailboxAddress(
    config.displayName, 
    config.emailAddress
  ));
  
  // 3. Set Subject
  let subject = message.parameters['Subject'] 
    || message.repliesTo?.parameters['Subject'];
  
  // Apply subject editing template
  if (config.editSubject?.includes('@@ASUNTO@@')) {
    const prefix = config.editSubject.split('@@ASUNTO@@')[0];
    if (!subject.startsWith(prefix)) {
      subject = config.editSubject.replace('@@ASUNTO@@', subject);
    }
  }
  mimeMessage.subject = subject;
  
  // 4. Set Reply-To if configured
  if (config.mailAddressForReplyTo) {
    mimeMessage.replyTo.add(new MailboxAddress(config.mailAddressForReplyTo));
  }
  
  // 5. Set recipients
  const toList = parseRecipients(message.parameters['To']);
  if (toList.length > 0) {
    toList.forEach(to => mimeMessage.to.add(new MailboxAddress(to, to)));
  } else if (message.repliesToSocialUser) {
    mimeMessage.to.add(new MailboxAddress(
      message.repliesToSocialUser.displayName,
      message.repliesToSocialUser.email
    ));
  }
  
  // 6. Set CC and BCC
  parseRecipients(message.parameters['Cc'])
    .forEach(cc => mimeMessage.cc.add(new MailboxAddress(cc, cc)));
  parseRecipients(message.parameters['Bcc'])
    .forEach(bcc => mimeMessage.bcc.add(new MailboxAddress(bcc, bcc)));
  
  // 7. Set In-Reply-To and References for threading
  if (message.repliesToSocialMessageID) {
    mimeMessage.inReplyTo = message.repliesToSocialMessageID;
    
    if (message.repliesTo?.parameters['References']) {
      mimeMessage.references.add(
        `${message.repliesTo.parameters['References']} ${message.repliesToSocialMessageID}`
      );
    } else {
      mimeMessage.references.add(message.repliesToSocialMessageID);
    }
  }
  
  // 8. Build body
  const bodyBuilder = new BodyBuilder();
  let htmlBody = message.getOriginalMailBody();
  
  // 9. Add signature
  if (settings.useSignature && settings.signatureBehaviour === 'AutoInsert') {
    let signature = settings.queuePriority && message.queue 
      ? message.queue.signature 
      : settings.signature;
    
    signature = signature.replace('@@USUARIO@@', message.repliedBy.fullName);
    htmlBody += signature;
  }
  
  // 10. Add quoted previous message
  if (config.sendConfig.usePreviousQuotes && config.sendConfig.quoteType) {
    htmlBody += resolveQuote(message, config);
  }
  
  bodyBuilder.htmlBody = htmlBody;
  
  // 11. Add attachments
  if (message.hasAttach) {
    for (const attach of message.attachments) {
      if (attach.isInline && attach.parameters['ContentId']) {
        const resource = bodyBuilder.linkedResources.add(
          attach.fileName, 
          attach.data, 
          ContentType.parse(attach.mimeType)
        );
        resource.contentId = attach.parameters['ContentId'];
      } else {
        bodyBuilder.attachments.add(
          attach.fileName, 
          attach.data, 
          ContentType.parse(attach.mimeType)
        );
      }
    }
  }
  
  mimeMessage.body = bodyBuilder.toMessageBody();
  
  // 12. Add custom header for tracking
  mimeMessage.headers.add('X-Message-ID-Social', mimeMessage.messageId);
  
  // 13. Send via appropriate protocol
  if (config.sendConfig.protocol === 'SMTP' || config.sendConfig.protocol === 'Gmail') {
    await sendSMTP(mimeMessage);
  } else {
    await sendEWS(mimeMessage);
  }
  
  return mimeMessage.messageId;
}
```

### 7.3 SMTP Sending

```typescript
async function sendSMTP(mimeMessage: MimeMessage): Promise<void> {
  const smtpClient = new SmtpClient();
  
  try {
    // Connect
    if (config.sendConfig.useSSL) {
      await smtpClient.connect(
        config.sendConfig.server, 
        config.sendConfig.port, 
        config.sendConfig.secureOptions
      );
    } else {
      await smtpClient.connect(
        config.sendConfig.server, 
        config.sendConfig.port, 
        SecureSocketOptions.None
      );
    }
    
    // Authenticate
    if (config.sendConfig.useCredentials) {
      await smtpClient.authenticate(
        config.sendConfig.username, 
        config.sendConfig.password
      );
    }
    
    // Send
    await smtpClient.send(mimeMessage);
    
  } finally {
    await smtpClient.disconnect(true);
    smtpClient.dispose();
  }
}
```

### 7.4 EWS Sending

```typescript
async function sendEWS(mimeMessage: MimeMessage): Promise<string> {
  const service = await connectToEWS();
  
  // Create email from MIME content
  const message = new EmailMessage(service);
  message.mimeContent = new MimeContent('UTF-8', mimeMessage.toByteArray());
  message.save();
  
  // Load and send
  message.load([BasePropertySet.FirstClassProperties, ItemSchema.MimeContent]);
  message.sendAndSaveCopy();
  
  return message.id.uniqueId;
}
```

---

## 8. Data Persistence

### 8.1 Message Entity Structure

```typescript
interface Message {
  id: number;
  socialMessageID: string;  // External email Message-ID
  body: string;
  date: Date;
  
  // Status tracking
  status: 'Push' | 'NotAssigned' | 'Assigned' | 'Replied' | 'Closed' | 'System' | 'Historical';
  deliveryRetries?: number;
  delivered?: boolean;
  deliveryError?: string;
  
  // Relationships
  service: Service;
  serviceType: ServiceType;
  postedBy?: SocialUser;
  repliesTo?: Message;
  repliesToSocialMessageID?: string;
  repliesToSocialUser?: SocialUser;
  repliedBy?: User;
  
  // Threading
  case?: Case;
  
  // Content
  hasAttach: boolean;
  attachments?: Attachment[];
  parameters: Record<string, string>;  // Mail-specific metadata
  
  // Flags
  incoming: boolean;
  outgoing: boolean;
  isReply: boolean;
  important: boolean;
}
```

### 8.2 Social User Entity

```typescript
interface SocialUser {
  id: number;
  socialServiceType: SocialServiceType;
  email: string;
  displayName: string;
  name: string;
  
  // Flags
  vip?: boolean;
  tester?: boolean;
  doNotCall?: boolean;
  blocked?: boolean;
  
  // Per-service tracking
  parametersByService: Record<number, {
    firstInteraction: Date;
    lastInteraction: Date;
    previousLastInteraction?: Date;
  }>;
}
```

### 8.3 Case/Conversation Handling

The system groups messages into "Cases" (conversations):

```typescript
// CaseHandling modes:
// 'CreateOneByThread' - Each email thread becomes a separate case
// 'CreateOne' - All emails from a user go to one case

async function getOrCreateCase(message: Message, service: Service): Promise<Case> {
  // 1. If replying to existing message, find its case
  if (message.repliesToSocialMessageID) {
    const parentMessage = await MessageDAO.getBySocialMessage(
      message.repliesToSocialMessageID
    );
    if (parentMessage?.case) {
      return parentMessage.case;
    }
  }
  
  // 2. Based on settings, find or create case
  if (settings.caseHandling === 'CreateOneByThread') {
    // New thread = new case
    return await CaseDAO.create({
      service,
      socialUser: message.postedBy,
      createdAt: new Date()
    });
  } else {
    // Find existing open case for this user
    const existingCase = await CaseDAO.findOpenForUser(
      message.postedBy, 
      service
    );
    return existingCase || await CaseDAO.create({...});
  }
}
```

---

## 9. Error Handling & Resilience

### 9.1 Authentication Errors

```typescript
async function sendError(ex: AuthenticationException) {
  // Throttle: only send one email every 30 minutes
  if (Date.now() - lastErrorSentTime < 30 * 60 * 1000) return;
  
  await SystemSettings.sendMailMessage(
    settings.authenticationErrorOcurred,
    {
      '@@FECHA@@': formatDate(new Date()),
      '@@SERVICIO@@': service.name,
      '@@ERROR@@': ex.message
    }
  );
  
  lastErrorSentTime = Date.now();
}
```

### 9.2 Inactivity Detection

```typescript
// After polling, if no messages received for too long, send alert
if (messages.length === 0) {
  const lastActivity = status.get('LastActivity') || new Date();
  const inactivityMinutes = (Date.now() - lastActivity) / 60000;
  
  if (inactivityMinutes > settings.minutesForInactivity) {
    // Throttle: one alert per hour
    if (Date.now() - lastInactivityAlertTime > 60 * 60 * 1000) {
      await SystemSettings.sendMailMessage(settings.inactivityDetected, {
        '@@SERVICIO@@': service.name,
        '@@MINUTOS@@': inactivityMinutes
      });
      lastInactivityAlertTime = Date.now();
    }
  }
} else {
  status.set('LastActivity', new Date().toISOString());
}
```

### 9.3 Retry Logic for Sending

```typescript
// In Service Bus processor
catch (error) {
  if (error instanceof ReplyException) {
    await MessageDAO.updateDelivered(
      message.id, 
      false, 
      error.message, 
      error.code, 
      error.shouldRetry
    );
    
    if (error.shouldRetry) {
      // Put back in queue for retry
      await args.abandonMessage(args.message);
    }
  }
}

// Max retries check
if (message.deliveryRetries >= SystemSettings.maxRetriesForOutgoingMessages) {
  // Give up - message will remain in failed state
  return;
}
```

---

## 10. Step-by-Step Flow

### 10.1 Receiving an Email (Complete Flow)

```
1. TIMER FIRES (every 35 seconds)
   │
   ▼
2. DoWork() is called
   │
   ├─ Verify license is valid
   ├─ Refresh system settings
   ├─ Load blocked users list
   │
   ▼
3. For each configured mail service:
   │
   ├─ ReconfigureService() - Check DB for config changes
   │
   ▼
4. QueryService(service, socialService)
   │
   ├─ Check service.enabled === true
   ├─ Check socialService.supportsQuery() === true
   ├─ Check validUntil hasn't passed
   │
   ▼
5. socialService.Query(cancellationToken)
   │
   ├─ Based on protocol, call:
   │   ├─ QueryIMAP()
   │   ├─ QueryPOP3()
   │   └─ QueryEWS()
   │
   ▼
6. Connect to mail server
   │
   ├─ IMAP: Connect → Authenticate → Open Inbox
   ├─ EWS: Connect → OAuth/Basic Auth
   │
   ▼
7. Search for unread messages since fromDate
   │
   ▼
8. For each message (limit 20):
   │
   ├─ Check ShouldIgnore():
   │   ├─ Too old? → Skip
   │   ├─ Already in DB? → Skip
   │   ├─ No sender? → Skip
   │   ├─ Bounce/Report? → Skip (if configured)
   │   └─ From error address? → Skip
   │
   ├─ Convert MimeMessage → MailMessage (Converter.Convert)
   │   ├─ Extract headers, body, subject
   │   ├─ Parse attachments
   │   ├─ Get/Create SocialUser for sender
   │   └─ Set repliesToSocialMessageID from In-Reply-To header
   │
   ├─ Check if sender is blocked → Skip if yes
   │
   ├─ Mark own replies as isReply = true
   │
   └─ Add to messages list
   │
   ▼
9. Mark messages as read/deleted on server (if configured)
   │
   ▼
10. Update service status (LastMailId, LastActivity)
    │
    ▼
11. Return messages list to Service.cs
    │
    ▼
12. For each message:
    │
    ├─ Check if already exists in DB → Skip
    │
    ├─ Handle outgoing messages (replies from outside tool):
    │   ├─ Is first in thread? → Insert as MissingMessage
    │   ├─ Parent exists in DB? → Insert as MissingMessage
    │   └─ Parent doesn't exist? → Skip
    │
    ├─ Handle incoming messages:
    │   ├─ Check for missing parent messages in thread
    │   │   └─ Recursively fetch and insert missing messages
    │   │
    │   └─ InsertMessage():
    │       ├─ InsertOrUpdateUser(postedBy)
    │       ├─ Set status = 'Push'
    │       ├─ MessageDAO.insertAsync(message)
    │       └─ StorageManager.saveIncomingMessage(message)
    │
    ▼
13. NotifySocialForNewServiceMessages(insertedMessageIds)
    │
    └─ POST to /services/messaging/news
    │
    ▼
14. Web app receives notification
    │
    ├─ Broadcasts via SignalR to connected agents
    │
    └─ Agents see new message in their queue
```

### 10.2 Sending a Reply (Complete Flow)

```
1. AGENT WRITES REPLY in web UI
   │
   ▼
2. Web app creates Message record with:
   │
   ├─ body = HTML content
   ├─ repliesToSocialMessageID = original message's socialMessageID
   ├─ repliesToSocialUser = recipient
   ├─ parameters['Subject'], ['To'], ['Cc'], ['Bcc']
   ├─ attachments (if any)
   ├─ status = 'Pending'
   │
   ▼
3. Message is queued to Azure Service Bus
   │
   └─ Queue: {clientId}-replies
   │
   ▼
4. Service Bus Processor receives message
   │
   ▼
5. ProcessMessagesAsync(args)
   │
   ├─ Parse message body to get messageId
   ├─ Load message from DB with all relations
   │
   ├─ Validate:
   │   ├─ Message exists?
   │   ├─ Service configured?
   │   ├─ Authorization required and granted?
   │   ├─ Retry limit not exceeded?
   │
   ▼
6. socialService.Reply(message)
   │
   ├─ Build MimeMessage:
   │   ├─ Set From: displayName <emailAddress>
   │   ├─ Set To: recipient(s)
   │   ├─ Set Cc/Bcc if provided
   │   ├─ Set Subject (with optional editing template)
   │   ├─ Set In-Reply-To: original messageId
   │   ├─ Set References: thread history
   │   │
   │   ├─ Build HTML body:
   │   │   ├─ Agent's message
   │   │   ├─ Signature (if configured)
   │   │   └─ Quoted previous message (if configured)
   │   │
   │   └─ Attach files (inline or regular)
   │
   ▼
7. Send via protocol:
   │
   ├─ SMTP:
   │   ├─ Connect to server
   │   ├─ Authenticate
   │   ├─ Send message
   │   └─ Disconnect
   │
   └─ EWS:
       ├─ Connect to Exchange
       ├─ Create EmailMessage from MIME
       ├─ SendAndSaveCopy()
       └─ Return unique ID
   │
   ▼
8. Update database:
   │
   ├─ MessageDAO.updateSocialMessage(id, sentMessageId)
   ├─ StorageManager.saveOutgoingMessage() (if configured)
   │
   ▼
9. Success! Message delivered.
   │
   └─ (On failure: increment retries, possibly requeue)
```

---

## 11. Replicating in Next.js

### 11.1 Recommended Architecture

```
your-nextjs-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── mail/
│   │   │   │   ├── poll/route.ts      # Cron/scheduled polling endpoint
│   │   │   │   ├── send/route.ts       # Send reply endpoint
│   │   │   │   └── webhook/route.ts    # Optional: webhook for push notifications
│   │   │   └── messages/
│   │   │       └── route.ts            # CRUD for messages
│   │   └── (pages)/
│   │       └── inbox/
│   │           └── page.tsx            # UI for viewing/replying
│   │
│   ├── lib/
│   │   ├── mail/
│   │   │   ├── config.ts               # Configuration types
│   │   │   ├── imap-client.ts          # IMAP implementation
│   │   │   ├── smtp-client.ts          # SMTP implementation
│   │   │   ├── ews-client.ts           # EWS implementation (optional)
│   │   │   ├── converter.ts            # Message conversion
│   │   │   └── service.ts              # Main mail service
│   │   │
│   │   ├── db/
│   │   │   ├── schema.ts               # Prisma/Drizzle schema
│   │   │   └── queries.ts              # Database operations
│   │   │
│   │   └── queue/
│   │       └── worker.ts               # Background job processor
│   │
│   └── types/
│       └── mail.ts                      # TypeScript interfaces
│
├── prisma/
│   └── schema.prisma                    # Database schema
│
└── cron-jobs/
    └── poll-mail.ts                     # Scheduled job (Vercel Cron, etc.)
```

### 11.2 Key Libraries for Next.js

```json
{
  "dependencies": {
    // Email handling
    "imapflow": "^1.0.0",          // Modern IMAP client
    "nodemailer": "^6.9.0",         // SMTP sending
    "mailparser": "^3.6.0",         // MIME parsing
    
    // Database
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0",
    
    // Background jobs
    "bullmq": "^4.0.0",             // Redis-based queue
    // OR
    "@vercel/cron": "^1.0.0",       // Vercel Cron Jobs
    
    // Real-time (optional)
    "pusher": "^5.0.0",             // Or Socket.io, etc.
    
    // Utilities
    "sanitize-html": "^2.11.0",     // Clean HTML
    "html-to-text": "^9.0.0"        // HTML to plain text
  }
}
```

### 11.3 Minimal Implementation Example

#### Configuration (lib/mail/config.ts)
```typescript
export interface MailConfig {
  imap: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  fromAddress: string;
  displayName: string;
  pollIntervalSeconds: number;
  fromDate: Date;
}

export const mailConfig: MailConfig = {
  imap: {
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  },
  smtp: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  },
  fromAddress: process.env.EMAIL_USER!,
  displayName: process.env.EMAIL_DISPLAY_NAME || 'Support',
  pollIntervalSeconds: 60,
  fromDate: new Date('2024-01-01'),
};
```

#### IMAP Polling (lib/mail/imap-client.ts)
```typescript
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { mailConfig } from './config';
import { prisma } from '../db/client';

export async function pollMails() {
  const client = new ImapFlow({
    host: mailConfig.imap.host,
    port: mailConfig.imap.port,
    secure: mailConfig.imap.secure,
    auth: mailConfig.imap.auth,
    logger: false,
  });

  try {
    await client.connect();
    
    const lock = await client.getMailboxLock('INBOX');
    
    try {
      // Search for unseen messages
      const messages = client.fetch(
        { seen: false, since: mailConfig.fromDate },
        { source: true, uid: true }
      );
      
      for await (const msg of messages) {
        // Parse the email
        const parsed = await simpleParser(msg.source);
        
        // Check if already exists
        const exists = await prisma.message.findUnique({
          where: { socialMessageId: parsed.messageId },
        });
        
        if (exists) continue;
        
        // Get or create sender
        const sender = await prisma.socialUser.upsert({
          where: { email: parsed.from?.value[0]?.address || '' },
          update: { lastSeen: new Date() },
          create: {
            email: parsed.from?.value[0]?.address || '',
            name: parsed.from?.value[0]?.name || '',
          },
        });
        
        // Create message
        await prisma.message.create({
          data: {
            socialMessageId: parsed.messageId || '',
            subject: parsed.subject || '',
            body: parsed.html || parsed.text || '',
            isHtml: !!parsed.html,
            date: parsed.date || new Date(),
            fromUserId: sender.id,
            inReplyTo: parsed.inReplyTo || null,
            references: parsed.references?.join(' ') || null,
            hasAttachments: (parsed.attachments?.length || 0) > 0,
            status: 'NEW',
          },
        });
        
        // Mark as seen
        await client.messageFlagsAdd(
          { uid: msg.uid },
          ['\\Seen']
        );
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
```

#### Sending Replies (lib/mail/smtp-client.ts)
```typescript
import nodemailer from 'nodemailer';
import { mailConfig } from './config';
import { prisma } from '../db/client';

export async function sendReply(messageId: number, body: string) {
  // Load message with relations
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { fromUser: true, replyTo: true },
  });
  
  if (!message) throw new Error('Message not found');
  
  const transporter = nodemailer.createTransport({
    host: mailConfig.smtp.host,
    port: mailConfig.smtp.port,
    secure: mailConfig.smtp.secure,
    auth: mailConfig.smtp.auth,
  });
  
  // Build the reply
  const mailOptions = {
    from: `"${mailConfig.displayName}" <${mailConfig.fromAddress}>`,
    to: message.fromUser.email,
    subject: message.subject.startsWith('Re:') 
      ? message.subject 
      : `Re: ${message.subject}`,
    html: body,
    inReplyTo: message.socialMessageId,
    references: message.references 
      ? `${message.references} ${message.socialMessageId}`
      : message.socialMessageId,
  };
  
  const result = await transporter.sendMail(mailOptions);
  
  // Save outgoing message
  await prisma.message.create({
    data: {
      socialMessageId: result.messageId,
      subject: mailOptions.subject,
      body: body,
      isHtml: true,
      date: new Date(),
      toUserId: message.fromUserId,
      inReplyTo: message.socialMessageId,
      references: mailOptions.references as string,
      status: 'SENT',
      isOutgoing: true,
      parentId: message.id,
    },
  });
  
  return result.messageId;
}
```

#### API Route for Polling (app/api/mail/poll/route.ts)
```typescript
import { NextResponse } from 'next/server';
import { pollMails } from '@/lib/mail/imap-client';

// For Vercel Cron Jobs
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (for security)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    await pollMails();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Poll failed:', error);
    return NextResponse.json({ error: 'Poll failed' }, { status: 500 });
  }
}
```

#### Prisma Schema (prisma/schema.prisma)
```prisma
model SocialUser {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String?
  blocked   Boolean   @default(false)
  vip       Boolean   @default(false)
  lastSeen  DateTime  @default(now())
  createdAt DateTime  @default(now())
  
  messagesFrom Message[] @relation("FromUser")
  messagesTo   Message[] @relation("ToUser")
}

model Message {
  id              Int       @id @default(autoincrement())
  socialMessageId String    @unique
  subject         String
  body            String    @db.Text
  isHtml          Boolean   @default(true)
  date            DateTime
  status          String    @default("NEW")
  isOutgoing      Boolean   @default(false)
  hasAttachments  Boolean   @default(false)
  
  // Threading
  inReplyTo   String?
  references  String?   @db.Text
  
  // Relations
  fromUserId  Int?
  fromUser    SocialUser? @relation("FromUser", fields: [fromUserId], references: [id])
  toUserId    Int?
  toUser      SocialUser? @relation("ToUser", fields: [toUserId], references: [id])
  
  parentId    Int?
  parent      Message?  @relation("Thread", fields: [parentId], references: [id])
  replies     Message[] @relation("Thread")
  
  attachments Attachment[]
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Attachment {
  id          Int     @id @default(autoincrement())
  messageId   Int
  message     Message @relation(fields: [messageId], references: [id])
  fileName    String
  mimeType    String
  size        Int
  isInline    Boolean @default(false)
  contentId   String?
  storageKey  String  // Path in S3/Storage
}
```

### 11.4 Deployment Considerations

| Aspect | ySocial Approach | Next.js Alternative |
|--------|------------------|---------------------|
| **Polling** | Windows Service with Timer | Vercel Cron Jobs, Railway Cron, or external scheduler |
| **Queue** | Azure Service Bus | BullMQ (Redis), Upstash, or Vercel KV |
| **Real-time** | Azure SignalR | Pusher, Socket.io, or Vercel AI SDK streaming |
| **Storage** | Azure Blob Storage | AWS S3, Cloudflare R2, or Vercel Blob |
| **Database** | SQL Server/MySQL | PostgreSQL (Neon, Supabase), PlanetScale |

---

## Summary

The ySocial mail system is a robust, enterprise-grade email handling solution with:

1. **Multi-protocol support** (IMAP, POP3, EWS, Gmail OAuth)
2. **Timer-based polling** with configurable intervals
3. **Comprehensive message conversion** preserving threading
4. **Reliable sending** through Azure Service Bus queue
5. **Real-time notifications** via SignalR
6. **Extensive error handling** and retry logic

For your Next.js implementation, focus on:
- Using `imapflow` for IMAP and `nodemailer` for SMTP
- Implementing cron jobs for polling (Vercel Cron or external)
- Using a queue system for reliable sending (BullMQ/Upstash)
- Properly handling threading via `In-Reply-To` and `References` headers
- Storing messages with proper status tracking
