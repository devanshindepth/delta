import fs from "fs";
import path from "path";
import { getDb } from "../lib/db/index";

const GCP_QUESTIONS = [
  {
    id: "q-gcp-001",
    objective_id: "obj-gcp-101",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You are designing the Google Cloud resource hierarchy for an enterprise with multiple business units. You need to ensure that security policies and compliance constraints (such as disabling external IP addresses on VMs) can be enforced centrally across all projects in the engineering department without preventing other departments from using external IPs. How should you structure the hierarchy?",
    options: [
      {
        id: "opt-1",
        text: "Create an Organization Policy constraint directly at the Organization node.",
        explanation: "Applying the constraint at the Organization node would affect all departments, violating the requirement."
      },
      {
        id: "opt-2",
        text: "Create a Folder for the Engineering department, place all engineering projects within this folder, and apply the Organization Policy constraint to the Engineering folder.",
        explanation: "Correct. Organization policies inherit down the resource hierarchy (Organization -> Folder -> Project). Applying the constraint at the Engineering folder enforces compliance for all engineering projects while leaving other folders unaffected."
      },
      {
        id: "opt-3",
        text: "Apply individual VPC firewall rules on each VM inside the engineering projects.",
        explanation: "Firewall rules manage traffic at the network level and cannot prevent developers from assigning public IP addresses during VM creation."
      },
      {
        id: "opt-4",
        text: "Assign the Compute Security Admin role to each engineering project individually.",
        explanation: "IAM roles grant authorization to users, but do not programmatically prevent VM configuration violations like organization policies do."
      }
    ],
    correct_answer: "opt-2",
    explanation: "Resource Manager Folders allow grouping projects to centrally administer IAM permissions and Organization Policies. Constraints defined at the Folder level are inherited by all child projects within that folder without affecting sibling folders.",
    official_doc_url: "https://cloud.google.com/resource-manager/docs/creating-managing-folders",
    service_tags: ["Resource Manager", "Organization Policies", "Hierarchy"]
  },
  {
    objective_id: "obj-gcp-102",
    id: "q-gcp-002",
    question_type: "mcq",
    difficulty: "exam",
    stem: "Your company has multiple Google Cloud projects linked to a central Cloud Billing account. The finance team requires an alert when the monthly cloud spend reaches 90% of the $10,000 budget. They also want to programmatically shut down test environment VMs if the budget reaches 100%. What should you configure?",
    options: [
      {
        id: "opt-1",
        text: "Configure a billing budget of $10,000 with email alerts at 90%, and configure a Pub/Sub notification channel connected to a Cloud Function to shut down test VMs at 100%.",
        explanation: "Correct. Cloud Billing budgets support email notifications at threshold percentages and can publish budget events to Pub/Sub topics to trigger serverless automation (Cloud Function / Cloud Run) to stop non-production resources."
      },
      {
        id: "opt-2",
        text: "Set a hard spending cap in the Cloud Billing console to automatically freeze all project APIs at 100%.",
        explanation: "Google Cloud Billing budgets do NOT provide an automatic built-in hard-cap switch; automation must be triggered via Pub/Sub."
      },
      {
        id: "opt-3",
        text: "Use Cloud Monitoring uptime checks to measure API billing metrics and trigger automated VM termination.",
        explanation: "Uptime checks test HTTP/TCP availability, not billing account spend."
      },
      {
        id: "opt-4",
        text: "Export billing data to BigQuery every 5 minutes and run a scheduled query to terminate VMs via gcloud.",
        explanation: "Billing data export to BigQuery occurs multiple times a day with batch latency, not in real-time."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Billing budgets send email alerts to Billing Admins by default. To take automated programmatic action (e.g. disabling billing or stopping test VMs), link the budget to a Cloud Pub/Sub topic and invoke a Cloud Function handler.",
    official_doc_url: "https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications",
    service_tags: ["Billing", "Budgets", "Pub/Sub", "Automation"]
  },
  {
    objective_id: "obj-gcp-103",
    id: "q-gcp-003",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You regularly work across three separate Google Cloud projects (development, staging, and production) with different user accounts, compute zones, and default settings. What is the most efficient way to manage and switch between these configurations using the Google Cloud CLI?",
    options: [
      {
        id: "opt-1",
        text: "Run `gcloud init` every time you need to switch environments.",
        explanation: "Running `gcloud init` each time requires going through the full interactive authentication flow."
      },
      {
        id: "opt-2",
        text: "Create a named configuration for each environment using `gcloud config configurations create <name>` and switch between them using `gcloud config configurations activate <name>`.",
        explanation: "Correct. Named configurations store distinct sets of properties (account, project, region, zone) and allow instant switching without re-authenticating."
      },
      {
        id: "opt-3",
        text: "Uninstall and reinstall the Google Cloud CLI in different directories on your machine.",
        explanation: "Multiple CLI installations are unnecessary and difficult to maintain."
      },
      {
        id: "opt-4",
        text: "Set environment variables `CLOUDSDK_CORE_PROJECT` manually in your shell for every single gcloud command.",
        explanation: "Manual environment variables are error-prone and do not manage accounts or regional defaults cleanly."
      }
    ],
    correct_answer: "opt-2",
    explanation: "The Google Cloud CLI supports named configurations (`gcloud config configurations create/activate/list`) which encapsulate account credentials, default project IDs, and compute regions for fast context switching.",
    official_doc_url: "https://cloud.google.com/sdk/docs/configurations",
    service_tags: ["gcloud", "CLI", "Named Configurations"]
  },
  {
    objective_id: "obj-gcp-201",
    id: "q-gcp-004",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You are planning the deployment of a stateless web processing workload on Compute Engine that will run continuously 24/7 for the entire year. The application requires predictable CPU and RAM performance. What is the most cost-effective pricing mechanism?",
    options: [
      {
        id: "opt-1",
        text: "Use On-Demand VMs with automatic Sustained Use Discounts (SUDs).",
        explanation: "SUDs provide up to 30% discount, but Committed Use Discounts (CUDs) offer substantially higher discounts for predictable 1-year or 3-year workloads."
      },
      {
        id: "opt-2",
        text: "Purchase a 1-year or 3-year Committed Use Discount (CUD) for the required compute resources.",
        explanation: "Correct. For steady-state workloads running continuously for a known duration of 1 or 3 years, CUDs provide the deepest discount (up to 57% for standard instances and 70% for memory-optimized) without upfront licensing fees."
      },
      {
        id: "opt-3",
        text: "Use Spot VM instances for all web processing nodes.",
        explanation: "Spot VMs can be preempted at any time with 30 seconds notice, making them unsuitable as the sole foundation for a continuous production web workload."
      },
      {
        id: "opt-4",
        text: "Use sole-tenant nodes with per-minute billing.",
        explanation: "Sole-tenant nodes carry a 10% premium over standard pricing and are intended for compliance/isolation needs."
      }
    ],
    correct_answer: "opt-2",
    explanation: "Committed Use Discounts (CUDs) are ideal for workloads with predictable resource needs. In exchange for committing to a continuous level of vCPU and memory for a 1-year or 3-year term, Google provides substantial discounts off on-demand rates.",
    official_doc_url: "https://cloud.google.com/compute/docs/sustained-use-discounts",
    service_tags: ["Compute Engine", "CUD", "SUD", "Cost Optimization"]
  },
  {
    objective_id: "obj-gcp-202",
    id: "q-gcp-005",
    question_type: "mcq",
    difficulty: "exam",
    stem: "A software team wants to build a lightweight API microservice that receives unpredictable HTTP webhooks. Traffic fluctuates from zero requests at night to hundreds per second during peak bursts. The team wants zero server management and minimal costs during idle periods. Which Google Cloud compute service should you recommend?",
    options: [
      {
        id: "opt-1",
        text: "Compute Engine VM with an autoscaled Managed Instance Group (MIG).",
        explanation: "MIGs incur baseline cost for running VMs and take minutes to scale from zero."
      },
      {
        id: "opt-2",
        text: "Cloud Run",
        explanation: "Correct. Cloud Run is a fully managed serverless platform that deploys stateless containers, scales automatically from zero to thousands of instances based on incoming HTTP requests, and charges only for processing time per 100ms."
      },
      {
        id: "opt-3",
        text: "Google Kubernetes Engine (GKE) Standard with 3 nodes.",
        explanation: "GKE Standard incurs fixed 24/7 costs for cluster management and node pool VMs."
      },
      {
        id: "opt-4",
        text: "App Engine Flexible Environment.",
        explanation: "App Engine Flexible requires at least 1 running VM instance and does not scale to zero."
      }
    ],
    correct_answer: "opt-2",
    explanation: "Cloud Run is purpose-built for containerized HTTP microservices with dynamic traffic. It automatically scales to zero when there is no traffic (eliminating idle cost) and scales out rapidly to meet traffic spikes.",
    official_doc_url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run",
    service_tags: ["Cloud Run", "Serverless", "Compute Selection"]
  },
  {
    objective_id: "obj-gcp-203",
    id: "q-gcp-006",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You need to store financial transaction records for compliance auditing. The records must be retained for exactly 7 years. The data will be accessed less than once a year, but when retrieved, it must be available within milliseconds. Which Cloud Storage class should you use?",
    options: [
      {
        id: "opt-1",
        text: "Standard Storage",
        explanation: "Standard storage has the highest storage cost per GB, making it cost-ineffective for archival data accessed once a year."
      },
      {
        id: "opt-2",
        text: "Nearline Storage",
        explanation: "Nearline storage is designed for data accessed once a month (30-day minimum retention)."
      },
      {
        id: "opt-3",
        text: "Archive Storage",
        explanation: "Correct. Archive Storage offers the lowest storage cost (for data accessed less than once a year, with 365-day minimum duration) while still providing sub-second (millisecond) retrieval latency, unlike cold storage on other cloud providers."
      },
      {
        id: "opt-4",
        text: "Cloud Bigtable",
        explanation: "Bigtable is an expensive high-throughput NoSQL database, not an object archive service."
      }
    ],
    correct_answer: "opt-3",
    explanation: "Cloud Storage Archive class is engineered for long-term digital preservation and regulatory compliance. It offers the lowest cost per GB and still delivers millisecond time-to-first-byte when accessed.",
    official_doc_url: "https://cloud.google.com/storage/docs/storage-classes",
    service_tags: ["Cloud Storage", "Storage Classes", "Archive"]
  },
  {
    objective_id: "obj-gcp-204",
    id: "q-gcp-007",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You have a custom VPC network with multiple subnets. You create two firewall rules:\nRule A: Priority 1000, Action: ALLOW, Protocol: TCP port 80, Source: 0.0.0.0/0, Target Tag: `web-server`\nRule B: Priority 500, Action: DENY, Protocol: TCP port 80, Source: 192.168.1.0/24, Target Tag: `web-server`\n\nA client with IP 192.168.1.50 sends an HTTP request on port 80 to a VM tagged `web-server`. What will happen?",
    options: [
      {
        id: "opt-1",
        text: "The request is ALLOWED because Rule A has a higher numeric priority value.",
        explanation: "In Google Cloud VPC firewall rules, lower numbers denote higher priority (0 is highest priority, 65535 is lowest)."
      },
      {
        id: "opt-2",
        text: "The request is DENIED because Rule B has priority 500, which takes precedence over Rule A (priority 1000).",
        explanation: "Correct. Google Cloud firewall rules evaluate in order of priority from lowest numerical value (0) to highest (65535). Since 500 < 1000, Rule B is evaluated first and denies the connection immediately."
      },
      {
        id: "opt-3",
        text: "The request is dropped because custom VPC networks do not support tags.",
        explanation: "Target tags and network tags are fully supported on custom VPC networks."
      },
      {
        id: "opt-4",
        text: "The request is ALLOWED because ALLOW rules always override DENY rules regardless of priority.",
        explanation: "Rule priority strictly determines evaluation order; action type does not supersede priority ranking."
      }
    ],
    correct_answer: "opt-2",
    explanation: "Firewall rule priority values range from 0 to 65535, with lower numbers representing higher priority. Evaluation terminates upon the first matching rule, so Rule B (priority 500) overrides Rule A (priority 1000).",
    official_doc_url: "https://cloud.google.com/vpc/docs/firewalls#rule_evaluation_order",
    service_tags: ["VPC", "Firewall Rules", "Priority Evaluation"]
  },
  {
    objective_id: "obj-gcp-301",
    id: "q-gcp-008",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You need to create a Compute Engine VM that automatically downloads software packages and configures a web server on first boot. How should you supply this automation using the gcloud CLI?",
    options: [
      {
        id: "opt-1",
        text: "Pass the bash script to the `--metadata=startup-script=...` or `--metadata-from-file=startup-script=...` flag during `gcloud compute instances create`.",
        explanation: "Correct. Startup scripts specified in instance metadata are automatically executed as root by the Compute Engine guest environment when the VM powers on."
      },
      {
        id: "opt-2",
        text: "Connect via SSH after the VM is created and paste the script manually into the terminal.",
        explanation: "Manual SSH execution does not provide automated deployment and cannot be used in autoscaled instance templates."
      },
      {
        id: "opt-3",
        text: "Upload the script to a Cloud Storage bucket and configure Cloud Scheduler to trigger it.",
        explanation: "Cloud Scheduler triggers HTTP endpoints or Pub/Sub topics, not arbitrary local VM shell scripts without guest agent hooks."
      },
      {
        id: "opt-4",
        text: "Embed the script in the OS Login public key description.",
        explanation: "OS Login manages Linux user authentication, not startup configuration."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Compute Engine supports `startup-script` metadata keys (or `startup-script-url` to load from Google Cloud Storage) to automate package installation, daemon configuration, and environment setup on boot.",
    official_doc_url: "https://cloud.google.com/compute/docs/instances/startup-scripts/linux",
    service_tags: ["Compute Engine", "Startup Scripts", "Metadata"]
  },
  {
    objective_id: "obj-gcp-302",
    id: "q-gcp-009",
    question_type: "mcq",
    difficulty: "exam",
    stem: "Your company is deploying a containerized application to Google Kubernetes Engine (GKE). You want Google to manage node provisioning, cluster scaling, security hardening, and OS updates so that your engineers only focus on deploying Pods. Which GKE cluster operational mode should you choose?",
    options: [
      {
        id: "opt-1",
        text: "GKE Standard mode with custom node pools",
        explanation: "Standard mode requires the administrator to select machine types, manage node pools, and configure OS upgrades."
      },
      {
        id: "opt-2",
        text: "GKE Autopilot mode",
        explanation: "Correct. In Autopilot mode, Google provisions and manages all underlying node infrastructure based on pod resource specifications, enforces security best practices, and automates cluster maintenance."
      },
      {
        id: "opt-3",
        text: "Standalone Kubernetes on Compute Engine VMs",
        explanation: "Self-managed Kubernetes has the highest administrative overhead."
      },
      {
        id: "opt-4",
        text: "Anthos Service Mesh on bare metal",
        explanation: "Anthos/GKE Enterprise on bare metal is intended for on-premises hybrid deployments."
      }
    ],
    correct_answer: "opt-2",
    explanation: "GKE Autopilot is a fully managed operational mode where Google manages the cluster architecture, node provisioning, and scaling according to Pod resource specifications.",
    official_doc_url: "https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview",
    service_tags: ["GKE", "Autopilot", "Kubernetes"]
  },
  {
    objective_id: "obj-gcp-303",
    id: "q-gcp-010",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You have deployed a Cloud Run service called `payment-api`. During high-volume marketing campaigns, sudden traffic spikes cause a latency spike due to container initialization (cold starts). How can you eliminate cold starts for critical requests while remaining serverless?",
    options: [
      {
        id: "opt-1",
        text: "Configure the `--min-instances` flag to at least 1 or more on the Cloud Run service.",
        explanation: "Correct. Setting `min-instances` keeps the specified number of container instances warm and ready in memory to process requests immediately without cold start delays."
      },
      {
        id: "opt-2",
        text: "Migrate the application to App Engine Standard with 0 instances.",
        explanation: "App Engine Standard with 0 instances will still experience cold starts upon receiving requests."
      },
      {
        id: "opt-3",
        text: "Decrease the `--concurrency` parameter to 1.",
        explanation: "Reducing concurrency forces Cloud Run to spin up more instances for simultaneous requests, worsening cold starts."
      },
      {
        id: "opt-4",
        text: "Enable CPU allocation only during request processing.",
        explanation: "Allocating CPU only during requests is the default behavior and does not keep idle instances warm."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Setting `--min-instances` guarantees that a baseline number of container instances stay running, eliminating cold-start latency for incoming traffic bursts.",
    official_doc_url: "https://cloud.google.com/run/docs/configuring/min-instances",
    service_tags: ["Cloud Run", "Min Instances", "Cold Start Optimization"]
  },
  {
    objective_id: "obj-gcp-304",
    id: "q-gcp-011",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You are setting up a production PostgreSQL database on Cloud SQL. You must ensure that the database can automatically fail over to another availability zone within the same region with zero data loss in the event of a datacenter outage. What setting is required?",
    options: [
      {
        id: "opt-1",
        text: "Enable High Availability (Regional availability type).",
        explanation: "Correct. High Availability in Cloud SQL provisions a primary and standby instance in two separate zones in the same region, using synchronous storage replication for automatic failover without data loss."
      },
      {
        id: "opt-2",
        text: "Configure a cross-region read replica and promote it manually.",
        explanation: "Manual replica promotion across regions is asynchronous and incurs failover downtime and potential data lag."
      },
      {
        id: "opt-3",
        text: "Take manual on-demand snapshots every hour.",
        explanation: "Snapshots provide backup recovery points, not automated sub-minute failover."
      },
      {
        id: "opt-4",
        text: "Deploy Cloud SQL in Zonal availability with read replicas.",
        explanation: "Zonal availability does not provide standby failover instances across zones."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Cloud SQL High Availability (HA) configuration provisions a standby instance in another zone. Synchronous replication keeps standby data identical, and automated failover activates if the primary zone becomes unreachable.",
    official_doc_url: "https://cloud.google.com/sql/docs/postgres/high-availability",
    service_tags: ["Cloud SQL", "High Availability", "Failover"]
  },
  {
    objective_id: "obj-gcp-401",
    id: "q-gcp-012",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You need to perform maintenance on a Compute Engine VM instance and change its machine type from `e2-standard-2` to `e2-standard-8`. What steps must you follow in sequence?",
    options: [
      {
        id: "opt-1",
        text: "Stop the VM instance -> Modify the machine type -> Start the VM instance.",
        explanation: "Correct. Compute Engine machine types can only be modified while the instance is in the `TERMINATED` (STOPPED) state. Once reconfigured, start the instance."
      },
      {
        id: "opt-2",
        text: "Modify the machine type on the live running instance with `gcloud compute instances update`.",
        explanation: "Compute Engine does not support dynamic live resizing of vCPU/RAM on a running instance."
      },
      {
        id: "opt-3",
        text: "Delete the VM instance -> Recreate a new VM instance with the desired machine type from scratch.",
        explanation: "Deleting the instance is destructive and unnecessary when attached boot disks can simply be stopped and reconfigured."
      },
      {
        id: "opt-4",
        text: "Suspend the VM instance -> Change machine type -> Resume the instance.",
        explanation: "Suspended VMs preserve RAM state to disk and cannot resume on a different CPU/RAM topology."
      }
    ],
    correct_answer: "opt-1",
    explanation: "To change machine attributes such as vCPU count or memory, the instance must be stopped (`gcloud compute instances stop`), updated (`set-machine-type`), and restarted.",
    official_doc_url: "https://cloud.google.com/compute/docs/instances/changing-machine-type-of-stopped-instance",
    service_tags: ["Compute Engine", "VM Lifecycle", "Machine Type Resizing"]
  },
  {
    objective_id: "obj-gcp-402",
    id: "q-gcp-013",
    question_type: "mcq",
    difficulty: "exam",
    stem: "A recent deployment of your application to a GKE cluster caused error rates to spike. You need to immediately roll back the deployment `frontend-app` to the previous stable revision. Which kubectl command should you run?",
    options: [
      {
        id: "opt-1",
        text: "kubectl rollout undo deployment/frontend-app",
        explanation: "Correct. `kubectl rollout undo` rolls back the Deployment to the previous revision in its rollout history."
      },
      {
        id: "opt-2",
        text: "kubectl delete deployment frontend-app",
        explanation: "Deleting the deployment terminates all application pods and causes complete service outage."
      },
      {
        id: "opt-3",
        text: "kubectl scale deployment frontend-app --replicas=0",
        explanation: "Scaling replicas to 0 stops all pods instead of restoring the previous working version."
      },
      {
        id: "opt-4",
        text: "kubectl apply -f deployment.yaml --force",
        explanation: "Reapplying the same manifest does not revert to the prior revision unless the YAML image tag is changed."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Kubernetes tracks deployment revision history. `kubectl rollout undo deployment/<name>` rolls back to the immediate previous revision, ensuring rapid incident recovery.",
    official_doc_url: "https://cloud.google.com/kubernetes-engine/docs/how-to/scaling-apps#rollout-undo",
    service_tags: ["GKE", "kubectl", "Rollback", "Deployment"]
  },
  {
    objective_id: "obj-gcp-403",
    id: "q-gcp-014",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You have deployed a new revision `v2` of a Cloud Run microservice. You want to test `v2` with 10% of live customer traffic while routing the remaining 90% to the stable `v1` revision. How should you configure this?",
    options: [
      {
        id: "opt-1",
        text: "Deploy two separate Cloud Run services and use Cloud DNS round-robin weighted records.",
        explanation: "Cloud DNS does not natively support weighted percentage routing."
      },
      {
        id: "opt-2",
        text: "Use Cloud Run Traffic Splitting to allocate 10% traffic to revision `v2` and 90% to revision `v1`.",
        explanation: "Correct. Cloud Run has built-in traffic splitting that routes incoming HTTP requests across revisions based on user-defined percentages."
      },
      {
        id: "opt-3",
        text: "Create a Cloud Function proxy that randomly redirects 10% of requests via HTTP 302.",
        explanation: "HTTP redirects add client latency and complicate client-side cookie/header handling."
      },
      {
        id: "opt-4",
        text: "Set `v2` instance concurrency to 10 and `v1` concurrency to 90.",
        explanation: "Concurrency controls simultaneous requests per container, not traffic routing distribution."
      }
    ],
    correct_answer: "opt-2",
    explanation: "Cloud Run supports native traffic splitting (`gcloud run services update-traffic`) between multiple revisions, enabling safe canary releases and gradual rollouts.",
    official_doc_url: "https://cloud.google.com/run/docs/managing/traffic-routing",
    service_tags: ["Cloud Run", "Traffic Splitting", "Canary Deployment"]
  },
  {
    objective_id: "obj-gcp-404",
    id: "q-gcp-015",
    question_type: "mcq",
    difficulty: "exam",
    stem: "Security compliance requires all Cloud Audit Logs and system error logs across your organization to be retained for 5 years for forensic analysis, and made queryable via SQL. Cloud Logging default retention is 30 days. What is the recommended solution?",
    options: [
      {
        id: "opt-1",
        text: "Create a Log Router sink in Cloud Logging with a destination of BigQuery, and set the BigQuery dataset table partition expiration to 5 years.",
        explanation: "Correct. Log Router sinks continuously stream log entries matching filter criteria to BigQuery, where standard SQL queries and long-term retention policies can be configured."
      },
      {
        id: "opt-2",
        text: "Write a bash script in Cloud Shell that runs `gcloud logging read` daily and saves files to local storage.",
        explanation: "Manual scripts in Cloud Shell are not durable, scalable, or compliant."
      },
      {
        id: "opt-3",
        text: "Increase Cloud Logging `_Default` bucket retention to 5 years in the console.",
        explanation: "Cloud Logging log bucket custom retention can be set up to 10 years, but does not provide direct ANSI SQL querying capabilities like BigQuery does."
      },
      {
        id: "opt-4",
        text: "Stream logs to Cloud Pub/Sub and discard messages after ACK.",
        explanation: "Pub/Sub is a temporary message queue with maximum 7-day retention, not a storage solution."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Cloud Logging Log Router sinks allow exporting log entries in real time to BigQuery datasets, enabling long-term compliance storage and SQL analytics.",
    official_doc_url: "https://cloud.google.com/logging/docs/routing/overview",
    service_tags: ["Cloud Logging", "Log Router", "BigQuery Sinks", "Compliance"]
  },
  {
    objective_id: "obj-gcp-501",
    id: "q-gcp-016",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You need to grant a junior engineer access to start and stop VM instances in a development project, but prevent them from deleting VMs, modifying firewall rules, or accessing Cloud Storage. Following the principle of least privilege, what should you do?",
    options: [
      {
        id: "opt-1",
        text: "Grant the primitive `roles/editor` role on the project.",
        explanation: "The primitive Editor role grants broad modification and deletion privileges across almost all services in the project."
      },
      {
        id: "opt-2",
        text: "Create a custom IAM role containing only `compute.instances.start`, `compute.instances.stop`, and `compute.instances.get` permissions, and bind it to the engineer's identity.",
        explanation: "Correct. When no predefined role matches the exact granular restriction required, creating a Custom Role with specific permissions enforces the principle of least privilege."
      },
      {
        id: "opt-3",
        text: "Grant the predefined `roles/compute.admin` role on the project.",
        explanation: "Compute Admin grants full control over compute instances, firewalls, and networks, violating least privilege."
      },
      {
        id: "opt-4",
        text: "Grant the primitive `roles/viewer` role and assign SSH key metadata.",
        explanation: "Viewer role is read-only and does not allow starting or stopping instances."
      }
    ],
    correct_answer: "opt-2",
    explanation: "Custom IAM roles allow curating exact permission sets when predefined roles are too broad, satisfying strict least-privilege compliance.",
    official_doc_url: "https://cloud.google.com/iam/docs/understanding-custom-roles",
    service_tags: ["IAM", "Custom Roles", "Least Privilege"]
  },
  {
    objective_id: "obj-gcp-502",
    id: "q-gcp-017",
    question_type: "mcq",
    difficulty: "exam",
    stem: "Your CI/CD pipeline running in GitHub Actions needs to deploy container images to Google Cloud Artifact Registry and update Cloud Run services. You want to authenticate securely without storing static, downloadable JSON service account keys in GitHub Secrets. What is the recommended security architecture?",
    options: [
      {
        id: "opt-1",
        text: "Configure Workload Identity Federation between GitHub Actions and Google Cloud IAM.",
        explanation: "Correct. Workload Identity Federation exchanges OpenID Connect (OIDC) identity tokens from GitHub Actions for short-lived Google Cloud access tokens, completely eliminating long-lived service account keys."
      },
      {
        id: "opt-2",
        text: "Generate a service account private key in JSON format, base64 encode it, and store it in GitHub repository secrets.",
        explanation: "Storing static JSON keys in external secret stores is a security risk because keys do not expire automatically and can be leaked."
      },
      {
        id: "opt-3",
        text: "Hardcode the service account email and password in the GitHub Actions workflow YAML file.",
        explanation: "Service accounts do not use passwords, and hardcoding credentials in repository code is unsafe."
      },
      {
        id: "opt-4",
        text: "Assign the GitHub Actions runner an external IP and add it to the Google Cloud authorized network list.",
        explanation: "IP whitelisting does not perform cryptographic identity authentication."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Workload Identity Federation allows external workloads (GitHub Actions, AWS, Azure) to authenticate to Google Cloud APIs using short-lived credentials, eliminating the operational and security risks of service account keys.",
    official_doc_url: "https://cloud.google.com/iam/docs/workload-identity-federation",
    service_tags: ["IAM", "Workload Identity Federation", "Service Accounts", "Keyless Auth"]
  },
  {
    objective_id: "obj-gcp-503",
    id: "q-gcp-018",
    question_type: "mcq",
    difficulty: "exam",
    stem: "You are investigating an incident where a confidential Cloud Storage bucket had objects read by an unauthorized entity. You check Cloud Logging for Data Access audit logs, but find no log entries for the read requests. What is the most likely reason?",
    options: [
      {
        id: "opt-1",
        text: "Data Access audit logs (except for BigQuery) are disabled by default to save storage costs and must be explicitly enabled in IAM audit configuration.",
        explanation: "Correct. Admin Activity audit logs are always enabled and free, but Data Access audit logs (which record read/write operations on user data) are disabled by default due to high volume and must be explicitly activated."
      },
      {
        id: "opt-2",
        text: "Cloud Storage does not support audit logging.",
        explanation: "Cloud Storage fully supports both Admin Activity and Data Access audit logging."
      },
      {
        id: "opt-3",
        text: "Audit logs are deleted immediately after 24 hours.",
        explanation: "Admin Activity logs are retained for 400 days; Data Access logs are retained for 30 days by default."
      },
      {
        id: "opt-4",
        text: "Only project Owners can view audit logs.",
        explanation: "Users with `roles/logging.viewer` or `roles/logging.privateLogViewer` can view audit logs."
      }
    ],
    correct_answer: "opt-1",
    explanation: "Data Access audit logs record API calls that read or write user-provided resource data. Because of high log volume, Data Access logs (Admin Read, Data Read, Data Write) are disabled by default for most services and require explicit activation in the IAM Audit Configuration.",
    official_doc_url: "https://cloud.google.com/logging/docs/audit/configure-data-access",
    service_tags: ["Cloud Audit Logs", "Data Access Logs", "Security Auditing"]
  }
];

export function seedGCPQuestions() {
  const db = getDb();
  console.log(`Inserting ${GCP_QUESTIONS.length} practice questions for Google Cloud ACE...`);

  // 1. Update gcp-ace.json
  const blueprintPath = path.join(process.cwd(), "data", "blueprints", "gcp-ace.json");
  if (fs.existsSync(blueprintPath)) {
    const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));
    blueprint.practice_questions = GCP_QUESTIONS;
    fs.writeFileSync(blueprintPath, JSON.stringify(blueprint, null, 2));
    console.log("[+] Updated data/blueprints/gcp-ace.json with practice questions.");
  }

  // 2. Insert into practice_questions table
  for (const q of GCP_QUESTIONS) {
    db.prepare(`
      INSERT OR REPLACE INTO practice_questions
        (id, objective_id, question_type, difficulty, stem,
         options_json, ordering_items_json, matching_pairs_json,
         case_study_json, sandbox_starter_code, sandbox_test_code,
         correct_answer, explanation, official_doc_url,
         service_tags, validation_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      q.id,
      q.objective_id,
      q.question_type,
      q.difficulty,
      q.stem,
      JSON.stringify(q.options),
      null,
      null,
      null,
      null,
      null,
      q.correct_answer,
      q.explanation,
      q.official_doc_url,
      JSON.stringify(q.service_tags),
      "verified_accurate"
    );
  }

  console.log(`[+] Successfully inserted all ${GCP_QUESTIONS.length} questions into DB.`);
}

if (require.main === module) {
  seedGCPQuestions();
}
