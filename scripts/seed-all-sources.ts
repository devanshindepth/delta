import { getDb } from "../lib/db/index";
import { saveScrapedSource } from "../lib/db/queries";
import crypto from "crypto";

interface SourceItem {
  objective_id: string;
  url: string;
  title: string;
  summary: string;
  learning_outcomes: string[];
  key_concepts: Array<{ term: string; definition: string }>;
  api_names?: string[];
  limits?: string[];
  code_examples?: string[];
}

// ── 1. Microsoft AI-103 Sources ──────────────────────────────────────────────
const AI103_SOURCES: SourceItem[] = [
  {
    objective_id: "obj-101",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource",
    title: "Select Azure AI Service Tier and Deployment Architecture",
    summary: "Azure AI services can be provisioned as multi-service resources sharing a single key/endpoint or as isolated single-service resources for distinct security boundaries.",
    learning_outcomes: [
      "Evaluate trade-offs between multi-service and single-service Azure AI resource tiers",
      "Configure serverless consumption versus Provisioned Throughput Units (PTU)",
      "Select target regions based on latency, model availability, and regulatory compliance"
    ],
    key_concepts: [
      {
        term: "Multi-Service vs Single-Service",
        definition: "Multi-service resources bundle Vision, Language, Speech, and Translator under a unified endpoint and billing meter; single-service resources provide isolated IAM and CMK encryption boundaries."
      },
      {
        term: "Provisioned Throughput Units (PTU)",
        definition: "Dedicated model serving capacity reserving throughput with predictable latency, eliminating rate-limiting (429) errors during peak loads."
      },
      {
        term: "Azure AI Studio Hub and Projects",
        definition: "Centralized governance container for managing shared storage, compute, fine-tuned models, and evaluation datasets."
      }
    ],
    api_names: ["Microsoft.CognitiveServices/accounts"],
    code_examples: ["az cognitiveservices account create --name my-ai --resource-group my-rg --kind AIServices --sku S0 --location westus2"]
  },
  {
    objective_id: "obj-102",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/authentication",
    title: "Implement Security, Managed Identities & Keyless Auth",
    summary: "Securing Azure AI workloads requires eliminating static keys by using Microsoft Entra ID authentication, Managed Identities, Azure RBAC, and Virtual Network Private Endpoints.",
    learning_outcomes: [
      "Implement keyless authentication using DefaultAzureCredential and Microsoft Entra ID",
      "Assign granular Azure RBAC roles (Cognitive Services User, Cognitive Services OpenAI Contributor)",
      "Secure AI endpoints using Private Link and Azure Key Vault Customer-Managed Keys (CMK)"
    ],
    key_concepts: [
      {
        term: "DefaultAzureCredential",
        definition: "A chained credential provider in the Azure Identity SDK that automatically selects Managed Identity in production and developer CLI credentials in local dev."
      },
      {
        term: "Managed Identity (System-assigned vs User-assigned)",
        definition: "An automatically managed identity in Microsoft Entra ID assigned to an Azure resource, eliminating hardcoded credentials."
      },
      {
        term: "Azure RBAC for AI",
        definition: "Predefined roles such as Cognitive Services User (data plane inference) and Cognitive Services Contributor (control plane management)."
      }
    ],
    api_names: ["azure.identity", "DefaultAzureCredential"],
    code_examples: ["from azure.identity import DefaultAzureCredential\ncredential = DefaultAzureCredential()"]
  },
  {
    objective_id: "obj-201",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-image-analysis",
    title: "Analyze Images with Azure AI Vision (Image Analysis 4.0)",
    summary: "Image Analysis 4.0 provides visual feature extraction including dense captioning, object detection with bounding boxes, OCR text reading, smart-crop thumbnail generation, and content moderation.",
    learning_outcomes: [
      "Construct Image Analysis 4.0 requests using visualFeatures parameters",
      "Extract dense captions and object bounding boxes with confidence scores",
      "Extract printed and handwritten text using synchronous Image Analysis OCR"
    ],
    key_concepts: [
      {
        term: "Visual Features",
        definition: "Parameters specifying extraction modules: Caption, DenseCaptions, Objects, Read, Tags, SmartCrops, and People."
      },
      {
        term: "Dense Captions",
        definition: "Generates localized descriptive sentences with bounding boxes for up to 10 visual regions within an image."
      },
      {
        term: "Read API (Synchronous OCR)",
        definition: "Extracts textual content, lines, and words along with bounding polygons directly within the Image Analysis 4.0 pipeline."
      }
    ],
    api_names: ["azure.ai.vision.imageanalysis", "ImageAnalysisClient"],
    code_examples: ["client = ImageAnalysisClient(endpoint=endpoint, credential=credential)\nresult = client.analyze(image_data, visual_features=[VisualFeatures.CAPTION, VisualFeatures.READ])"]
  },
  {
    objective_id: "obj-202",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/overview",
    title: "Extract Text and Key-Value Pairs with Document Intelligence",
    summary: "Azure AI Document Intelligence uses advanced machine learning to extract text, key-value pairs, tables, selection marks (checkboxes), and document structure from PDFs, forms, and images.",
    learning_outcomes: [
      "Select and deploy Document Intelligence prebuilt models (Invoice, Receipt, ID document, Layout)",
      "Extract complex multi-page tables, selection marks, and structured key-value pairs",
      "Train custom neural and custom template models for specialized document layouts"
    ],
    key_concepts: [
      {
        term: "Prebuilt Layout Model",
        definition: "Extracts text, selection marks (checkboxes), tables, paragraphs, and reading order without requiring custom model training."
      },
      {
        term: "Custom Neural vs Custom Template",
        definition: "Custom Template models extract from structured forms with identical visual layouts; Custom Neural models generalize across unstructured or varied document formats."
      },
      {
        term: "AnalyzeDocumentOperation",
        definition: "The asynchronous SDK operation polling for document analysis results from the REST API 2024-11-30."
      }
    ],
    api_names: ["azure.ai.documentintelligence", "DocumentIntelligenceClient"],
    code_examples: ["poller = client.begin_analyze_document('prebuilt-layout', body=file_stream)\nresult = poller.result()"]
  },
  {
    objective_id: "obj-203",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/custom-vision-service/overview",
    title: "Train and Deploy Custom Vision Models",
    summary: "Custom Vision allows building specialized computer vision classifiers and object detectors using transfer learning with small training sample sets, exportable to ONNX for edge deployment.",
    learning_outcomes: [
      "Create multiclass vs multilabel image classification and object detection projects",
      "Upload tagged images and trigger iterative training runs (General vs Compact domains)",
      "Publish trained model iterations and export compact models to ONNX/TensorFlow"
    ],
    key_concepts: [
      {
        term: "Multiclass vs Multilabel Classification",
        definition: "Multiclass assigns exactly one label per image; Multilabel allows assigning multiple tags to a single image."
      },
      {
        term: "Compact Domains",
        definition: "Model architectures optimized for edge execution on mobile devices or IoT gateways using ONNX/CoreML/TensorFlow."
      },
      {
        term: "Training & Prediction Keys",
        definition: "Training key authors tags and initiates training iterations; Prediction key authorizes inference queries against published endpoints."
      }
    ],
    api_names: ["azure.cognitiveservices.vision.customvision"],
    code_examples: ["trainer.train_project(project_id)"]
  },
  {
    objective_id: "obj-301",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/language-service/overview",
    title: "Analyze Text using Azure AI Language Service",
    summary: "Azure AI Language provides unified NLP capabilities including Named Entity Recognition (NER), Personally Identifiable Information (PII) detection and redaction, sentiment analysis, and key phrase extraction.",
    learning_outcomes: [
      "Extract entities, categories, subcategories, and confidence scores using NER",
      "Redact sensitive data (SSN, credit card, email, phone) using PII entity recognition",
      "Perform sentiment analysis and opinion mining (aspect-based sentiment) on customer reviews"
    ],
    key_concepts: [
      {
        term: "PII Detection & Redaction",
        definition: "Identifies sensitive personal information and returns both entity coordinates and masked redacted text."
      },
      {
        term: "Opinion Mining (Aspect-Based Sentiment)",
        definition: "Evaluates target words (aspects) and their associated sentiment assessments (e.g. 'food was great, service was slow')."
      },
      {
        term: "TextAnalyticsClient",
        definition: "The core SDK client class used to execute single-service and batch NLP operations."
      }
    ],
    api_names: ["azure.ai.textanalytics", "TextAnalyticsClient"],
    code_examples: ["client.recognize_pii_entities(documents=['User email is test@example.com'])"]
  },
  {
    objective_id: "obj-302",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/language-service/conversational-language-understanding/overview",
    title: "Implement Conversational Language Understanding (CLU)",
    summary: "Conversational Language Understanding (CLU) is the modern replacement for legacy LUIS, enabling developers to extract user intents and learned/prebuilt entities from natural language dialogues.",
    learning_outcomes: [
      "Author intents, learned entities, list entities, and prebuilt components in Language Studio",
      "Train and publish CLU deployment slots (staging vs production)",
      "Execute runtime conversational analysis queries with ConversationAnalysisClient"
    ],
    key_concepts: [
      {
        term: "Intents and Entities",
        definition: "Intents represent the user's overall purpose (e.g., BookFlight); Entities extract specific parameter details (e.g., Destination, Date)."
      },
      {
        term: "CLU Orchestration Workflow",
        definition: "Routes conversational turns across multiple CLU projects, Question Answering knowledge bases, and Azure OpenAI models."
      },
      {
        term: "LUIS Migration to CLU",
        definition: "LUIS is deprecated; projects must be imported and re-trained under CLU in Azure AI Language."
      }
    ],
    api_names: ["azure.ai.language.conversations", "ConversationAnalysisClient"],
    code_examples: ["client.analyze_conversation(task={'kind': 'Conversation', 'analysisInput': {'conversationItem': {'text': 'Book a flight to Seattle'}}})"]
  },
  {
    objective_id: "obj-303",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/overview",
    title: "Deploy Speech Recognition and Neural Text-to-Speech",
    summary: "Azure AI Speech provides real-time speech-to-text, phrase lists for industry terminology, neural voice synthesis with customized SSML prosody, and speech translation.",
    learning_outcomes: [
      "Configure Speech SDK for real-time and continuous speech-to-text recognition",
      "Improve transcription accuracy using Phrase Lists for domain-specific terminology",
      "Synthesize natural speech using neural voices and Speech Synthesis Markup Language (SSML)"
    ],
    key_concepts: [
      {
        term: "SpeechRecognizer & AudioConfig",
        definition: "Core SDK classes that connect audio input streams (microphone, WAV file, push stream) to Azure Speech endpoints."
      },
      {
        term: "Speech Synthesis Markup Language (SSML)",
        definition: "XML-based standard specifying pitch, rate, pronunciation, speaking style (e.g. cheerful, empathetic), and voice persona."
      },
      {
        term: "Phrase Lists",
        definition: "Biases speech recognition models toward specific jargon, acronyms, or product names during decoding."
      }
    ],
    api_names: ["azure.cognitiveservices.speech", "SpeechRecognizer", "SpeechSynthesizer"],
    code_examples: ["speech_config = SpeechConfig(subscription=key, region=region)\nspeech_recognizer = SpeechRecognizer(speech_config=speech_config)"]
  },
  {
    objective_id: "obj-401",
    url: "https://learn.microsoft.com/en-us/azure/search/cognitive-search-concept-intro",
    title: "Design Indexing Architecture and Cognitive Skillsets",
    summary: "Azure AI Search uses an indexing pipeline that ingests data from Azure sources, applies cognitive skillset transformations (OCR, entity extraction, text split), and writes to search indexes and Knowledge Stores.",
    learning_outcomes: [
      "Configure data sources, index definitions, and automated Indexer schedules",
      "Build cognitive skillset pipelines with built-in skills (OcrSkill, EntityRecognitionSkill, SplitSkill)",
      "Project structured enrichment data to Knowledge Store tables and JSON blobs for downstream analytics"
    ],
    key_concepts: [
      {
        term: "Indexer & Skillset Pipeline",
        definition: "The indexer pulls raw data, cracks documents, executes cognitive skills in dependency order, and maps outputs into index fields."
      },
      {
        term: "Enrichment Tree (`/document/...`)",
        definition: "The internal JSON representation created during document cracking that tracks outputs of upstream skills."
      },
      {
        term: "Knowledge Store",
        definition: "A persistence target in Azure Storage (Tables, Objects, Files) storing structured skillset outputs independent of the search index."
      }
    ],
    api_names: ["azure.search.documents.indexes", "SearchIndexerClient"],
    code_examples: ["client.create_skillset(skillset)"]
  },
  {
    objective_id: "obj-402",
    url: "https://learn.microsoft.com/en-us/azure/search/vector-search-overview",
    title: "Implement Vector Search, Hybrid Querying & Semantic Reranking",
    summary: "Azure AI Search enables hybrid search combining traditional BM25 keyword search with high-dimensional vector embeddings and semantic L2 reranking for optimal search relevance in RAG architectures.",
    learning_outcomes: [
      "Define vector fields with dimensions and vector search profiles (HNSW algorithm)",
      "Execute hybrid queries combining full-text search and VectorizedQuery parameters with Reciprocal Rank Fusion (RRF)",
      "Enable Semantic Ranker to re-score top candidate documents using Bing deep learning models and generate semantic captions"
    ],
    key_concepts: [
      {
        term: "HNSW (Hierarchical Navigable Small World)",
        definition: "An approximate nearest neighbor (ANN) vector indexing algorithm offering low query latency and high recall."
      },
      {
        term: "Reciprocal Rank Fusion (RRF)",
        definition: "Algorithm that scores and merges search result lists from BM25 lexical search and dense vector search into a single unified ranking."
      },
      {
        term: "Semantic Ranker (L2 Reranker)",
        definition: "Applies a transformer-based language model to evaluate relevance, extracting semantic captions and highlights from candidate passages."
      }
    ],
    api_names: ["azure.search.documents", "SearchClient", "VectorizedQuery"],
    code_examples: ["results = search_client.search(search_text='cloud security', vector_queries=[vector_query], query_type='semantic', semantic_configuration_name='my-semantic-config')"]
  },
  {
    objective_id: "obj-501",
    url: "https://learn.microsoft.com/en-us/azure/bot-service/bot-service-overview-introduction",
    title: "Build Multi-Turn Dialogs with Bot Framework SDK",
    summary: "The Bot Framework SDK provides stateful dialog management, WaterfallDialog multi-step workflows, prompt validation, and middleware for conversational bots deployed on Azure Bot Service.",
    learning_outcomes: [
      "Manage UserState, ConversationState, and DialogState with storage providers (Cosmos DB, Blob Storage)",
      "Construct multi-step WaterfallDialogs with PromptValidators (TextPrompt, ChoicePrompt, DateTimePrompt)",
      "Implement middleware components for telemetry logging, translation, and exception handling"
    ],
    key_concepts: [
      {
        term: "UserState vs ConversationState",
        definition: "UserState persists properties scoped to a specific user across all conversations; ConversationState persists properties scoped to a specific chat session."
      },
      {
        term: "WaterfallDialog",
        definition: "A sequence of step functions where the result of one prompt step is passed as argument into the subsequent step."
      },
      {
        term: "BotStateSet & Auto-Save Middleware",
        definition: "Coordinates atomic saving of all state changes at the end of each conversational turn."
      }
    ],
    api_names: ["botbuilder.core", "botbuilder.dialogs", "WaterfallDialog"],
    code_examples: ["dialogs.add(WaterfallDialog('main_dialog', [step1, step2]))"]
  },
  {
    objective_id: "obj-502",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/language-service/question-answering/overview",
    title: "Integrate Custom Question Answering with Active Learning",
    summary: "Custom Question Answering in Azure AI Language builds knowledge bases from semi-structured FAQs, manual QnA pairs, and documents, supporting multi-turn follow-up prompts and active learning feedback loops.",
    learning_outcomes: [
      "Create and publish Question Answering knowledge bases from URLs, files, and chitchat personas",
      "Configure contextual multi-turn prompts and metadata filtering for precise responses",
      "Enable Active Learning to suggest candidate questions based on real user traffic"
    ],
    key_concepts: [
      {
        term: "Multi-Turn Conversations (Contextual QnA)",
        definition: "Links follow-up prompt buttons to parent questions to guide users through diagnostic decision trees."
      },
      {
        term: "Active Learning",
        definition: "Identifies high-confidence variations in user queries and suggests them to knowledge base authors for approval."
      },
      {
        term: "Metadata Filtering",
        definition: "Tags QnA pairs with key-value metadata to restrict answer searches based on user role, product edition, or region."
      }
    ],
    api_names: ["azure.ai.language.questionanswering", "QuestionAnsweringClient"],
    code_examples: ["response = client.get_answers(question='How do I reset password?', project_name='FAQ')"]
  }
];

// ── 2. AWS SAA-C03 Sources ───────────────────────────────────────────────────
const AWSSAA_SOURCES: SourceItem[] = [
  {
    objective_id: "obj-aws-101",
    url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html",
    title: "Design Secure Access to AWS Resources",
    summary: "AWS IAM manages identity and access control across AWS accounts. Architects design least-privilege policies, evaluate IAM roles for compute, configure IAM Identity Center (SSO), and enforce Service Control Policies (SCPs).",
    learning_outcomes: [
      "Determine when to choose between IAM users, groups, roles, and identity-based vs resource-based policies",
      "Enforce organization-wide guardrails using AWS Organizations Service Control Policies (SCPs)",
      "Configure IAM Permission Boundaries and cross-account IAM role assumption"
    ],
    key_concepts: [
      {
        term: "IAM Roles for EC2 & Lambda",
        definition: "Allows AWS compute services to obtain temporary security credentials automatically without embedding hardcoded access keys."
      },
      {
        term: "Service Control Policies (SCPs)",
        definition: "Organizational guardrails that specify the maximum allowed permissions for member accounts without granting permissions directly."
      },
      {
        term: "IAM Permission Boundary",
        definition: "An advanced feature that uses a managed policy to set the maximum permissions that an identity-based policy can grant to an IAM user or role."
      },
      {
        term: "IAM Identity Center (AWS SSO)",
        definition: "Centrally manages single sign-on access to multiple AWS accounts and business cloud applications."
      }
    ],
    api_names: ["iam.amazonaws.com", "organizations.amazonaws.com"],
    limits: ["An explicit DENY in any IAM policy, SCP, or Permission Boundary always overrides any ALLOW."],
    code_examples: ["aws iam create-role --role-name AppRole --assume-role-policy-document file://trust-policy.json"]
  },
  {
    objective_id: "obj-aws-102",
    url: "https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Security.html",
    title: "Design Secure Workloads and Applications",
    summary: "Workload protection requires layered security using VPC Security Groups, Network ACLs, AWS WAF, AWS Shield, AWS Secrets Manager, and TLS certificate management via ACM.",
    learning_outcomes: [
      "Configure stateful Security Groups and stateless Network ACLs with proper subnet tiering",
      "Protect web applications against common web exploits (SQL injection, XSS) using AWS WAF and Shield",
      "Store and automatically rotate database credentials using AWS Secrets Manager"
    ],
    key_concepts: [
      {
        term: "Security Groups vs Network ACLs",
        definition: "Security Groups operate at the instance/ENI level, are stateful, and only support ALLOW rules; NACLs operate at the subnet level, are stateless, and evaluate ordered ALLOW and DENY rules."
      },
      {
        term: "AWS WAF & AWS Shield",
        definition: "AWS WAF filters HTTP/HTTPS web application traffic; AWS Shield Standard provides automatic L3/L4 DDoS protection, with Shield Advanced providing dedicated 24/7 response."
      },
      {
        term: "AWS Secrets Manager",
        definition: "Securely encrypts and automatically rotates database credentials (RDS, DocumentDB) using Lambda rotation functions."
      }
    ],
    api_names: ["ec2.amazonaws.com", "wafv2.amazonaws.com", "secretsmanager.amazonaws.com"],
    code_examples: ["aws secretsmanager create-secret --name prod/db/creds --secret-string '{\"username\":\"admin\",\"password\":\"P@ssw0rd123\"}'"]
  },
  {
    objective_id: "obj-aws-103",
    url: "https://docs.aws.amazon.com/kms/latest/developerguide/overview.html",
    title: "Determine Appropriate Data Security Controls",
    summary: "Data protection across storage services involves encryption at rest (AWS KMS, CloudHSM), encryption in transit (TLS/SSL), S3 Bucket Policies, and automated sensitive data discovery using Amazon Macie.",
    learning_outcomes: [
      "Differentiate AWS KMS key types (AWS Owned, AWS Managed, Customer Managed Keys - CMK)",
      "Enforce S3 bucket encryption, Block Public Access, and Object Lock for WORM compliance",
      "Discover and protect PII / sensitive data in Amazon S3 using Amazon Macie"
    ],
    key_concepts: [
      {
        term: "KMS Customer Managed Keys (CMK)",
        definition: "Keys created and managed by the customer that support key rotation, key policies, cross-account sharing, and deletion scheduling."
      },
      {
        term: "S3 Block Public Access",
        definition: "Centralized account-level and bucket-level security control that prevents accidental public bucket exposure."
      },
      {
        term: "S3 Object Lock (WORM)",
        definition: "Stores objects using a Write Once, Read Many (WORM) model in Governance or Compliance mode to prevent deletion."
      },
      {
        term: "Amazon Macie",
        definition: "Fully managed data security and privacy service using machine learning to discover, classify, and protect sensitive data in S3."
      }
    ],
    api_names: ["kms.amazonaws.com", "s3.amazonaws.com", "macie2.amazonaws.com"],
    code_examples: ["aws s3api put-bucket-encryption --bucket my-bucket --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"aws:kms\",\"KMSMasterKeyID\":\"arn:aws:kms:...\"}}]}'"]
  },
  {
    objective_id: "obj-aws-201",
    url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html",
    title: "Design Scalable and Loosely Coupled Architectures",
    summary: "Loosely coupled architectures decouple producers and consumers using asynchronous messaging (Amazon SQS, Amazon SNS), event routing (Amazon EventBridge), and workflow orchestration (AWS Step Functions).",
    learning_outcomes: [
      "Decouple microservices using Amazon SQS Standard and FIFO message queues with Dead-Letter Queues (DLQ)",
      "Implement publish/subscribe fan-out architectures using Amazon SNS and SQS",
      "Orchestrate multi-step distributed workflows and error recovery using AWS Step Functions"
    ],
    key_concepts: [
      {
        term: "SQS Standard vs FIFO",
        definition: "Standard queues provide nearly unlimited throughput with at-least-once delivery; FIFO queues guarantee exact-once processing and strict message ordering up to 3,000 msg/s with batching."
      },
      {
        term: "SNS Fan-Out Pattern",
        definition: "A message published to an SNS topic is replicated in parallel to multiple subscribed SQS queues for parallel asynchronous processing."
      },
      {
        term: "Amazon EventBridge",
        definition: "Serverless event bus that ingests events from AWS services, SaaS apps, and custom apps, routing them to targets using declarative JSON filter rules."
      },
      {
        term: "AWS Step Functions",
        definition: "Visual serverless state machine orchestrating Lambda functions, ECS tasks, and AWS services with built-in retry and catch blocks."
      }
    ],
    api_names: ["sqs.amazonaws.com", "sns.amazonaws.com", "events.amazonaws.com", "states.amazonaws.com"],
    code_examples: ["aws sqs create-queue --queue-name order-processing.fifo --attributes FifoQueue=true,ContentBasedDeduplication=true"]
  },
  {
    objective_id: "obj-aws-202",
    url: "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html",
    title: "Design Highly Available and Fault-Tolerant Architectures",
    summary: "Achieving high availability requires distributing workloads across Multiple Availability Zones (Multi-AZ) using Elastic Load Balancers (ALB, NLB), EC2 Auto Scaling, Route 53 DNS routing, and Multi-AZ database deployments.",
    learning_outcomes: [
      "Select appropriate Elastic Load Balancer types (ALB for HTTP/HTTPS L7 routing vs NLB for ultra-low latency TCP/UDP L4)",
      "Configure EC2 Auto Scaling groups with dynamic target tracking policies across Multi-AZ subnets",
      "Implement Amazon Route 53 DNS routing policies (Failover, Geolocation, Latency, Weighted)"
    ],
    key_concepts: [
      {
        term: "Application Load Balancer (ALB)",
        definition: "Operates at Layer 7, supporting host-based and path-based routing, gRPC, WebSockets, and direct integration with Lambda and AWS WAF."
      },
      {
        term: "Network Load Balancer (NLB)",
        definition: "Operates at Layer 4, capable of handling millions of requests per second with ultra-low latency and static/Elastic IP support."
      },
      {
        term: "RDS Multi-AZ Deployment",
        definition: "Synchronously replicates database transactions to a standby instance in a different AZ, automatically failing over in 60-120 seconds."
      },
      {
        term: "Route 53 Active-Passive Failover",
        definition: "Uses Route 53 health checks to route primary traffic to a primary region and redirect to a backup secondary DR site upon health failure."
      }
    ],
    api_names: ["elasticloadbalancing.amazonaws.com", "autoscaling.amazonaws.com", "route53.amazonaws.com", "rds.amazonaws.com"],
    code_examples: ["aws autoscaling create-auto-scaling-group --auto-scaling-group-name web-asg --launch-template LaunchTemplateName=web-lt --min-size 2 --max-size 10 --vpc-zone-identifier 'subnet-1,subnet-2'"]
  },
  {
    objective_id: "obj-aws-203",
    url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html",
    title: "Select Appropriate AWS Storage Solutions",
    summary: "Storage architecture requires selecting the right storage paradigm: Object (S3), Block (EBS), File (EFS, FSx for Windows, FSx for Lustre), or Hybrid (Storage Gateway) based on workload requirements.",
    learning_outcomes: [
      "Differentiate storage models: Object (S3), Block (EBS), and Shared File Systems (EFS, FSx)",
      "Select optimal Amazon EBS volume types (gp3, io2 Block Express, st1, sc1)",
      "Configure Amazon EFS for multi-AZ shared POSIX Linux file access and FSx for high-throughput compute"
    ],
    key_concepts: [
      {
        term: "Amazon EBS (Elastic Block Store)",
        definition: "Network-attached block storage for EC2; gp3 offers independent baseline 3,000 IOPS and 125 MB/s throughput; io2 offers up to 256,000 IOPS and 99.999% durability."
      },
      {
        term: "Amazon EFS (Elastic File System)",
        definition: "Fully managed, scalable, serverless POSIX NFS shared file system supporting concurrent access from thousands of EC2/ECS/Lambda instances."
      },
      {
        term: "Amazon FSx (Lustre & Windows)",
        definition: "FSx for Lustre accelerates high-performance computing (HPC) and machine learning; FSx for Windows File Server provides native SMB integration with Active Directory."
      },
      {
        term: "AWS Storage Gateway",
        definition: "Hybrid cloud storage appliance connecting on-premises environments to AWS storage (File Gateway, Volume Gateway, Tape Gateway)."
      }
    ],
    api_names: ["s3.amazonaws.com", "ec2.amazonaws.com", "efs.amazonaws.com", "fsx.amazonaws.com"],
    code_examples: ["aws efs create-file-system --performance-mode generalPurpose --throughput-mode elastic --encrypted"]
  },
  {
    objective_id: "obj-aws-301",
    url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-volume-types.html",
    title: "Determine High-Performing and Elastic Storage Solutions",
    summary: "Optimizing storage throughput and IOPS involves tuning EBS gp3/io2 provisioned IOPS, enabling S3 Transfer Acceleration, configuring Amazon EFS Elastic Throughput, and caching with CloudFront.",
    learning_outcomes: [
      "Provision and tune high-IOPS EBS volumes for latency-sensitive databases",
      "Accelerate globally distributed S3 uploads and downloads using S3 Transfer Acceleration",
      "Deploy Amazon CloudFront CDN distributions with origin shield and edge caching"
    ],
    key_concepts: [
      {
        term: "EBS gp3 vs io2 Block Express",
        definition: "gp3 allows provisioning IOPS and throughput independently without adding disk capacity; io2 Block Express delivers up to 256,000 IOPS and sub-millisecond latency."
      },
      {
        term: "S3 Transfer Acceleration",
        definition: "Uses AWS CloudFront's globally distributed Edge Locations to route uploads to S3 over the optimized AWS private network backbone."
      },
      {
        term: "CloudFront Origin Shield",
        definition: "A centralized caching layer between CloudFront edge locations and origin servers that reduces origin load and protects backend databases."
      }
    ],
    api_names: ["ec2.amazonaws.com", "cloudfront.amazonaws.com"],
    code_examples: ["aws ec2 create-volume --volume-type gp3 --iops 10000 --throughput 500 --size 500 --availability-zone us-east-1a"]
  },
  {
    objective_id: "obj-aws-302",
    url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html",
    title: "Design High-Performing and Elastic Compute Solutions",
    summary: "High-performing compute architectures select appropriate EC2 instance families (General, Compute, Memory, Accelerator), placement groups, and serverless compute with AWS Lambda and Amazon ECS/EKS.",
    learning_outcomes: [
      "Select optimal EC2 instance types and configure EC2 Placement Groups (Cluster, Spread, Partition)",
      "Build elastic event-driven compute with AWS Lambda and provisioned concurrency",
      "Deploy containerized microservices on Amazon ECS with AWS Fargate serverless execution"
    ],
    key_concepts: [
      {
        term: "EC2 Placement Groups",
        definition: "Cluster (single AZ, low latency 10Gbps+ HPC), Spread (separate hardware racks across AZs for critical VMs), Partition (spreads across logical partitions for Hadoop/Kafka)."
      },
      {
        term: "AWS Fargate",
        definition: "Serverless compute engine for Amazon ECS and EKS that runs containers without provisioning or managing EC2 servers."
      },
      {
        term: "Lambda Provisioned Concurrency",
        definition: "Pre-warms execution environments to eliminate cold-start latency for double-digit millisecond response times."
      }
    ],
    api_names: ["ec2.amazonaws.com", "lambda.amazonaws.com", "ecs.amazonaws.com"],
    code_examples: ["aws ec2 create-placement-group --group-name hpc-cluster --strategy cluster"]
  },
  {
    objective_id: "obj-aws-303",
    url: "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html",
    title: "Determine High-Performing Database Solutions",
    summary: "Database performance optimization involves choosing between Amazon Aurora (distributed relational), Amazon DynamoDB (NoSQL key-value), Amazon ElastiCache (in-memory caching), and Amazon Redshift (data warehousing).",
    learning_outcomes: [
      "Architect relational workloads with Amazon Aurora Global Databases and up to 15 auto-scaling Read Replicas",
      "Achieve single-digit millisecond latency at scale with Amazon DynamoDB and DynamoDB Accelerator (DAX)",
      "Accelerate read throughput using Amazon ElastiCache (Redis vs Memcached) in front of RDS/DynamoDB"
    ],
    key_concepts: [
      {
        term: "Amazon Aurora Architecture",
        definition: "Separates compute from storage, replicating 6 copies of data across 3 AZs; provides up to 5x throughput of standard MySQL and sub-second cross-region replication."
      },
      {
        term: "DynamoDB Accelerator (DAX)",
        definition: "Fully managed, in-memory cache for DynamoDB that delivers microsecond response times for read-heavy workloads."
      },
      {
        term: "ElastiCache Redis vs Memcached",
        definition: "Redis supports complex data structures, persistence, replication, and multi-AZ failover; Memcached is a simple multithreaded key-value cache."
      }
    ],
    api_names: ["rds.amazonaws.com", "dynamodb.amazonaws.com", "elasticache.amazonaws.com"],
    code_examples: ["aws rds create-db-cluster --db-cluster-identifier aurora-prod --engine aurora-postgresql --master-username root --master-user-password Password123"]
  },
  {
    objective_id: "obj-aws-304",
    url: "https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html",
    title: "Determine High-Performing and Scalable Networking Solutions",
    summary: "High-performance networking connects on-premises and multi-region AWS environments using AWS Global Accelerator, AWS Transit Gateway, AWS Direct Connect, and VPC Endpoints (PrivateLink).",
    learning_outcomes: [
      "Improve global application performance and availability using AWS Global Accelerator Anycast static IPs",
      "Interconnect thousands of VPCs and on-premises networks using AWS Transit Gateway as a central hub",
      "Access AWS services securely without traversing the public internet using AWS PrivateLink interface endpoints"
    ],
    key_concepts: [
      {
        term: "AWS Global Accelerator",
        definition: "Uses Anycast static IPs to route global user traffic into the nearest AWS Edge Location and over the private AWS global network backbone."
      },
      {
        term: "AWS Transit Gateway",
        definition: "A regional network transit hub that connects VPCs, Direct Connect gateways, and VPNs in a scalable hub-and-spoke topology."
      },
      {
        term: "AWS PrivateLink",
        definition: "Provides private connectivity between VPCs and supported AWS services without exposing traffic to the internet."
      }
    ],
    api_names: ["globalaccelerator.amazonaws.com", "ec2.amazonaws.com"],
    code_examples: ["aws globalaccelerator create-accelerator --name web-accelerator --ip-address-type IPV4"]
  },
  {
    objective_id: "obj-aws-401",
    url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-opt-in.html",
    title: "Design Cost-Optimized Storage Solutions",
    summary: "Storage cost optimization employs S3 Lifecycle rules, S3 Intelligent-Tiering, Amazon S3 Glacier Deep Archive, and Data Lifecycle Manager (DLM) for automated snapshot retention.",
    learning_outcomes: [
      "Configure automated S3 Lifecycle configuration rules to transition and expire objects",
      "Deploy S3 Intelligent-Tiering to automatically move objects between access tiers with zero operational overhead",
      "Automate EBS snapshot creation and deletion using Amazon Data Lifecycle Manager (DLM)"
    ],
    key_concepts: [
      {
        term: "S3 Lifecycle Policies",
        definition: "Rules that automatically transition objects from S3 Standard -> Standard-IA -> Glacier Flexible -> Glacier Deep Archive based on age."
      },
      {
        term: "S3 Intelligent-Tiering",
        definition: "Automatically moves data between Frequent, Infrequent (30 days), Archive Instant, Archive (90 days), and Deep Archive (180 days) access tiers based on access patterns."
      },
      {
        term: "Amazon Data Lifecycle Manager (DLM)",
        definition: "Automates the creation, retention, and deletion of EBS volume snapshots and EBS-backed AMIs to control snapshot storage costs."
      }
    ],
    api_names: ["s3.amazonaws.com", "dlm.amazonaws.com"],
    code_examples: ["aws s3api put-bucket-lifecycle-configuration --bucket my-bucket --lifecycle-configuration file://lifecycle.json"]
  },
  {
    objective_id: "obj-aws-402",
    url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-pricing-models.html",
    title: "Design Cost-Optimized Compute Solutions",
    summary: "Compute cost reduction requires selecting the optimal pricing model: On-Demand, Savings Plans, Reserved Instances, or Spot Instances, guided by AWS Compute Optimizer.",
    learning_outcomes: [
      "Evaluate Compute Savings Plans vs EC2 Instance Savings Plans for predictable workloads",
      "Leverage Spot Instances with EC2 Auto Scaling mixed instances policies for fault-tolerant workloads",
      "Analyze underutilized CPU/memory resources using AWS Compute Optimizer recommendations"
    ],
    key_concepts: [
      {
        term: "Compute Savings Plans",
        definition: "Provides up to 66% discount in exchange for a commitment to a consistent amount of compute usage ($/hour) across EC2, Fargate, and Lambda."
      },
      {
        term: "Spot Instances & Mixed Instances Groups",
        definition: "Utilizes unused EC2 capacity at up to 90% discount; Auto Scaling mixed instances policies combine On-Demand baseline with Spot bursts."
      },
      {
        term: "AWS Compute Optimizer",
        definition: "Machine learning service that analyzes historical CloudWatch metrics to recommend right-sizing EC2, EBS, Lambda, and ECS configurations."
      }
    ],
    api_names: ["ec2.amazonaws.com", "savingsplans.amazonaws.com", "compute-optimizer.amazonaws.com"],
    code_examples: ["aws compute-optimizer get-ec2-instance-recommendations"]
  },
  {
    objective_id: "obj-aws-403",
    url: "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html",
    title: "Design Cost-Optimized Database Solutions",
    summary: "Database cost efficiency optimizes capacity planning using Aurora Serverless v2, DynamoDB On-Demand vs Provisioned Capacity, RDS Reserved Instances, and ElastiCache data tiering.",
    learning_outcomes: [
      "Deploy Aurora Serverless v2 with fine-grained fractional Aurora Capacity Units (ACUs) for unpredictable workloads",
      "Select DynamoDB On-Demand capacity mode for spiky workloads vs Provisioned Capacity with Auto Scaling for steady workloads",
      "Purchase 1-year or 3-year RDS Reserved DB Instances for steady-state production databases"
    ],
    key_concepts: [
      {
        term: "Aurora Serverless v2",
        definition: "Instantly scales database capacity in increments of 0.5 ACUs up or down in milliseconds to match demand, minimizing overprovisioning."
      },
      {
        term: "DynamoDB On-Demand vs Provisioned",
        definition: "On-demand charges strictly per read/write request unit without capacity planning; Provisioned with auto-scaling is cheaper for predictable high-volume traffic."
      },
      {
        term: "ElastiCache Data Tiering",
        definition: "Stores frequently accessed data in memory and less frequently accessed data on NVMe SSDs, reducing cluster memory costs by over 60%."
      }
    ],
    api_names: ["rds.amazonaws.com", "dynamodb.amazonaws.com"],
    code_examples: ["aws rds create-db-cluster --db-cluster-identifier serverless-db --engine aurora-postgresql --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=16"]
  },
  {
    objective_id: "obj-aws-404",
    url: "https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html",
    title: "Design Cost-Optimized Network Architectures",
    summary: "Network cost optimization reduces inter-AZ and internet egress data transfer fees using Gateway VPC Endpoints for S3 and DynamoDB, same-AZ routing, and CloudFront edge delivery.",
    learning_outcomes: [
      "Eliminate NAT Gateway data processing charges using free Gateway VPC Endpoints for Amazon S3 and DynamoDB",
      "Minimize inter-AZ data transfer fees by routing application traffic within the same Availability Zone",
      "Lower outbound internet data transfer costs using Amazon CloudFront distribution caching"
    ],
    key_concepts: [
      {
        term: "Gateway VPC Endpoints (Free)",
        definition: "Direct routing entries in VPC route tables connecting EC2 to S3 and DynamoDB over AWS internal network with zero per-GB data processing fees."
      },
      {
        term: "Inter-AZ vs Same-AZ Data Transfer",
        definition: "Data transfer within the same Availability Zone is free; data transfer across AZs in the same region is billed in both directions."
      },
      {
        term: "NAT Gateway Pricing Trade-offs",
        definition: "NAT Gateways incur hourly charges plus $0.045/GB data processing fees; high-volume S3 traffic should always use Gateway Endpoints instead of NAT."
      }
    ],
    api_names: ["ec2.amazonaws.com"],
    code_examples: ["aws ec2 create-vpc-endpoint --vpc-id vpc-12345 --service-name com.amazonaws.us-east-1.s3 --route-table-ids rtb-12345"]
  }
];

export function seedAllSources() {
  const db = getDb();
  console.log("=== Seeding Scraped Sources for All 3 Certifications ===");

  const allSources = [...AI103_SOURCES, ...AWSSAA_SOURCES];

  for (const src of allSources) {
    const rawContent = JSON.stringify({
      title: src.title,
      summary: src.summary,
      learning_outcomes: src.learning_outcomes,
      key_concepts: src.key_concepts,
      api_names: src.api_names || [],
      limits: src.limits || [],
      code_examples: src.code_examples || []
    });

    const contentHash = `sha256:${crypto.createHash("sha256").update(rawContent).digest("hex")}`;
    const sourceId = `src-seed-${src.objective_id}`;

    // Clean existing
    db.prepare("DELETE FROM scraped_sources WHERE objective_id = ?").run(src.objective_id);

    saveScrapedSource({
      id: sourceId,
      url: src.url,
      title: `Official documentation: ${src.title}`,
      rawContent,
      contentHash,
      scrapeMethod: "brightdata-scraper-studio-primary",
      status: "success",
      objectiveId: src.objective_id,
    });
  }

  console.log(`[+] Seeded ${AI103_SOURCES.length} Microsoft AI-103 sources.`);
  console.log(`[+] Seeded ${AWSSAA_SOURCES.length} AWS SAA-C03 sources.`);
}

if (require.main === module) {
  seedAllSources();
}
