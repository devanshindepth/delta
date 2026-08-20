import { getDb } from "../lib/db/index";
import { saveScrapedSource, getObjectivesByCertId } from "../lib/db/queries";
import crypto from "crypto";

interface GCPSourceData {
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

const GCP_SOURCES: GCPSourceData[] = [
  {
    objective_id: "obj-gcp-101",
    url: "https://cloud.google.com/resource-manager/docs/creating-managing-projects",
    title: "Creating and Managing Google Cloud Projects & Resource Hierarchy",
    summary: "Google Cloud projects form the basis for creating, enabling, and using all Google Cloud services. Projects belong to a hierarchical tree consisting of Organization, Folder, and Project nodes.",
    learning_outcomes: [
      "Create and configure Google Cloud projects using Cloud Console and gcloud CLI",
      "Structure resource hierarchy across Organizations, Folders, and Projects for centralized policy control",
      "Manage project lifecycle, billing account linkages, and API enablement"
    ],
    key_concepts: [
      {
        term: "Resource Manager Hierarchy",
        definition: "The organizational structure (Organization -> Folders -> Projects -> Resources) enabling inherited IAM permissions and Organization Policies."
      },
      {
        term: "Project ID vs Project Number",
        definition: "Project ID is a globally unique user-defined string (e.g. 'my-app-prod-101'); Project Number is an immutable system-assigned 12-digit integer."
      },
      {
        term: "Organization Policies",
        definition: "Centralized configuration constraints (e.g., disable default service account key creation, restrict VM external IPs) enforced across the hierarchy."
      },
      {
        term: "Service Usage API",
        definition: "The programmatic interface used to enable or disable specific Google Cloud APIs per project."
      }
    ],
    api_names: ["cloudresourcemanager.googleapis.com", "serviceusage.googleapis.com"],
    limits: ["Maximum default project quotas vary by billing tier; can be increased via quota requests."],
    code_examples: [
      "gcloud projects create my-project-id --name=\"Production App\" --folder=1234567890",
      "gcloud services enable compute.googleapis.com container.googleapis.com --project=my-project-id"
    ]
  },
  {
    objective_id: "obj-gcp-102",
    url: "https://cloud.google.com/billing/docs/how-to/manage-billing-account",
    title: "Managing Cloud Billing Accounts, Budgets, and Cost Allocation",
    summary: "Cloud Billing accounts track all resource charges across linked projects. Administrators define budgets, threshold rules, and automated export sinks to BigQuery for cost governance.",
    learning_outcomes: [
      "Link and unlink Google Cloud projects to Cloud Billing accounts",
      "Create spending budgets with percentage-based alerting thresholds and Pub/Sub notifications",
      "Export daily and detailed pricing billing data to BigQuery for analysis"
    ],
    key_concepts: [
      {
        term: "Cloud Billing Account",
        definition: "A top-level entity connected to a Google payments profile that pays for resource consumption across linked projects."
      },
      {
        term: "Billing Budget & Alerts",
        definition: "Threshold rules configured to notify billing admins via email or Pub/Sub when actual or forecasted spend exceeds target amounts (e.g. 50%, 90%, 100%)."
      },
      {
        term: "BigQuery Billing Export",
        definition: "Automated daily export of detailed cost and usage records into a designated BigQuery dataset for customized SQL reporting."
      },
      {
        term: "Billing IAM Roles",
        definition: "Roles such as Billing Account User (allows linking projects to billing) and Billing Account Administrator (manages financial terms and access)."
      }
    ],
    api_names: ["cloudbilling.googleapis.com", "bigquery.googleapis.com"],
    limits: ["Budgets do NOT automatically stop resources unless connected via Pub/Sub to Cloud Functions."],
    code_examples: [
      "gcloud beta billing projects link my-project-id --billing-account=012345-6789AB-CDEF01",
      "gcloud billing accounts list"
    ]
  },
  {
    objective_id: "obj-gcp-103",
    url: "https://cloud.google.com/sdk/docs/install",
    title: "Installing, Configuring, and Managing the Google Cloud CLI (gcloud)",
    summary: "The Google Cloud CLI provides a unified command-line tool for managing Google Cloud resources. Named configurations allow operators to switch seamlessly between projects, accounts, and regions.",
    learning_outcomes: [
      "Install and initialize the Google Cloud CLI (gcloud, gsutil, bq, kubectl)",
      "Create and switch between named configurations for multi-account and multi-environment workflows",
      "Leverage Google Cloud Shell for browser-based, pre-authenticated CLI access"
    ],
    key_concepts: [
      {
        term: "Named Configurations",
        definition: "Stored profiles containing active credentials, default project, default compute region, and compute zone."
      },
      {
        term: "gcloud init & gcloud auth",
        definition: "Commands used to authenticate via browser OAuth, set default configurations, and authorize service accounts."
      },
      {
        term: "Cloud Shell",
        definition: "An ephemeral Debian-based virtual machine with persistent 5GB home directory, pre-installed tools, and built-in Cloud Shell Editor."
      },
      {
        term: "Component Manager",
        definition: "CLI package manager used to install or update extensions (e.g., `gcloud components install gke-gcloud-auth-plugin`)."
      }
    ],
    api_names: ["gcloud", "gsutil", "bq", "kubectl"],
    limits: ["Cloud Shell sessions terminate after 20 minutes of inactivity; weekly usage limit is 50 hours."],
    code_examples: [
      "gcloud init",
      "gcloud config configurations create staging-env",
      "gcloud config set project my-staging-project",
      "gcloud config set compute/region us-central1"
    ]
  },
  {
    objective_id: "obj-gcp-201",
    url: "https://cloud.google.com/compute/docs/sustained-use-discounts",
    title: "Planning and Estimating Product Costs with Discounts",
    summary: "Cost estimation on Google Cloud requires understanding base resource rates, automated Sustained Use Discounts (SUDs), committed use agreements (CUDs), and Spot VM pricing.",
    learning_outcomes: [
      "Model monthly and annual infrastructure expenditure using the Google Cloud Pricing Calculator",
      "Calculate savings from automated Sustained Use Discounts (SUDs) on continuous workloads",
      "Evaluate 1-year and 3-year Committed Use Discounts (CUDs) for predictable capacity"
    ],
    key_concepts: [
      {
        term: "Pricing Calculator",
        definition: "Interactive web utility for generating detailed monthly cost estimates across compute, storage, networking, and databases."
      },
      {
        term: "Sustained Use Discounts (SUDs)",
        definition: "Automatic discounts of up to 30% applied when Compute Engine VM instances or GKE nodes run for more than 25% of a billing month."
      },
      {
        term: "Committed Use Discounts (CUDs)",
        definition: "Contracts committing to continuous resource or spend levels for 1 or 3 years in exchange for significant discounts (up to 57% on compute)."
      },
      {
        term: "Spot VMs (Preemptible)",
        definition: "Excess compute capacity available at 60-91% discounts that Google can reclaim with 30 seconds notice."
      }
    ],
    api_names: ["cloudpricing.googleapis.com"],
    limits: ["Spot VMs have no maximum runtime limit but can be preempted at any time depending on demand."],
    code_examples: [
      "gcloud compute instances create batch-worker --zone=us-central1-a --provisioning-model=SPOT --instance-termination-action=STOP"
    ]
  },
  {
    objective_id: "obj-gcp-202",
    url: "https://cloud.google.com/compute/docs/machine-types",
    title: "Planning and Selecting Google Cloud Compute Resources",
    summary: "Google Cloud provides diverse compute models ranging from bare VMs (Compute Engine) to managed Kubernetes (GKE), container services (Cloud Run), and PaaS (App Engine).",
    learning_outcomes: [
      "Select optimal Compute Engine machine series (General-purpose, Compute-optimized, Memory-optimized, Accelerator-optimized)",
      "Evaluate trade-offs between IaaS (Compute Engine), CaaS (GKE), Serverless Containers (Cloud Run), and FaaS (Cloud Functions)",
      "Size vCPU and memory allocations with custom machine types to prevent overprovisioning"
    ],
    key_concepts: [
      {
        term: "General-Purpose Series (E2, N2, N2D, C3)",
        definition: "Balanced vCPU-to-memory ratios suitable for web servers, databases, and microservices workloads."
      },
      {
        term: "Compute-Optimized (C2, C2D)",
        definition: "Highest single-thread performance and per-core memory bandwidth, ideal for high-performance computing (HPC) and gaming."
      },
      {
        term: "Cloud Run vs GKE",
        definition: "Cloud Run provides zero-management container execution with automatic scale-to-zero; GKE provides cluster orchestration, custom networking, and GPU node pools."
      },
      {
        term: "Custom Machine Types",
        definition: "Allows specifying exact vCPU count and RAM quantity without being restricted to predefined sizes."
      }
    ],
    api_names: ["compute.googleapis.com", "container.googleapis.com", "run.googleapis.com"],
    limits: ["E2 instances use shared core architecture with burstable CPU performance."],
    code_examples: [
      "gcloud compute instances create custom-vm --custom-vm-type=n2 --custom-cpu=6 --custom-memory=12GB --zone=us-central1-a"
    ]
  },
  {
    objective_id: "obj-gcp-203",
    url: "https://cloud.google.com/storage/docs/storage-classes",
    title: "Planning and Configuring Data Storage Architecture",
    summary: "Data storage selection aligns workload access patterns and durability requirements to object storage (Cloud Storage), relational databases (Cloud SQL, Spanner), NoSQL (Firestore, Bigtable), and analytics warehouses (BigQuery).",
    learning_outcomes: [
      "Select appropriate Cloud Storage classes (Standard, Nearline, Coldline, Archive) based on retention time and access frequency",
      "Choose between relational systems (Cloud SQL for regional workloads vs Cloud Spanner for global ACID consistency)",
      "Differentiate NoSQL document storage (Firestore) from high-throughput wide-column time-series storage (Cloud Bigtable)"
    ],
    key_concepts: [
      {
        term: "Storage Classes & Min Duration",
        definition: "Standard (immediate/frequent), Nearline (30-day min duration), Coldline (90-day min duration), Archive (365-day min duration for regulatory backup)."
      },
      {
        term: "Cloud SQL vs Cloud Spanner",
        definition: "Cloud SQL manages MySQL/PostgreSQL/SQL Server up to 64TB per instance; Cloud Spanner provides horizontally scalable, globally distributed relational tables with 99.999% SLA."
      },
      {
        term: "Firestore vs Cloud Bigtable",
        definition: "Firestore is a NoSQL document database for mobile and web apps; Bigtable is a low-latency NoSQL database for petabyte-scale streaming telemetry and IoT."
      },
      {
        term: "BigQuery",
        definition: "Serverless, multi-cloud enterprise data warehouse with built-in ML, geospatial analysis, and BI engine."
      }
    ],
    api_names: ["storage.googleapis.com", "sqladmin.googleapis.com", "spanner.googleapis.com", "bigtable.googleapis.com"],
    limits: ["Early deletion of Nearline/Coldline/Archive objects incurs retrieval and minimum storage duration fees."],
    code_examples: [
      "gcloud storage buckets create gs://my-archive-bucket --default-storage-class=coldline --location=us-central1"
    ]
  },
  {
    objective_id: "obj-gcp-204",
    url: "https://cloud.google.com/vpc/docs/vpc",
    title: "Planning and Designing Virtual Private Cloud (VPC) Networking",
    summary: "Google Cloud VPC provides a global, software-defined network spanning all regions. Subnets are regional resources connected via global routing, firewalls, and load balancers.",
    learning_outcomes: [
      "Design custom VPC networks with regional subnets and primary/secondary IP ranges",
      "Configure stateful VPC firewall rules using priority numbers, target tags, and service accounts",
      "Select appropriate Cloud Load Balancers (External Application Load Balancer, Network Load Balancer, Internal Load Balancer)"
    ],
    key_concepts: [
      {
        term: "Global VPC & Subnets",
        definition: "VPCs are global resources without regional boundaries; subnets are regional, allowing VMs across continents to communicate over internal RFC 1918 IPs without VPN."
      },
      {
        term: "Firewall Rule Priority",
        definition: "Firewall rules range from 0 (highest) to 65535 (default allow egress, default deny ingress); evaluated sequentially until the first match."
      },
      {
        term: "Cloud Load Balancing Tiers",
        definition: "Global External Application Load Balancers (HTTP/HTTPS with Cloud CDN & Cloud Armor) vs Regional Internal Network Load Balancers."
      },
      {
        term: "VPC Network Peering vs Shared VPC",
        definition: "VPC Peering connects independent VPC networks across organizations; Shared VPC shares subnets from a central Host Project to multiple Service Projects."
      }
    ],
    api_names: ["compute.googleapis.com", "dns.googleapis.com"],
    limits: ["Shared VPC requires all projects to belong to the exact same Google Cloud Organization."],
    code_examples: [
      "gcloud compute networks create custom-vpc --subnet-mode=custom",
      "gcloud compute networks subnets create web-subnet --network=custom-vpc --region=us-central1 --range=10.0.1.0/24",
      "gcloud compute firewall-rules create allow-http --network=custom-vpc --allow=tcp:80 --target-tags=web-server"
    ]
  },
  {
    objective_id: "obj-gcp-301",
    url: "https://cloud.google.com/compute/docs/instances/create-start-instance",
    title: "Deploying and Implementing Compute Engine Resources",
    summary: "Compute Engine deployment involves configuring VM instances, provisioning boot and attached disks, setting custom metadata and startup scripts, and configuring Managed Instance Groups (MIGs).",
    learning_outcomes: [
      "Create Compute Engine VM instances using gcloud CLI, Cloud Console, and Terraform templates",
      "Attach Persistent Disks (Zonal & Regional) and Local SSDs with appropriate mount configurations",
      "Deploy regional Managed Instance Groups (MIGs) with autoscaling policies and autohealing health checks"
    ],
    key_concepts: [
      {
        term: "Startup Scripts & Custom Metadata",
        definition: "Key-value pairs passed to instances upon creation; startup-script key executes bash commands on instance boot to install packages and configure daemons."
      },
      {
        term: "Persistent Disks (Standard, Balanced, SSD, Extreme)",
        definition: "Network-attached durable block storage that persists independently of VM lifetime; supports multi-writer mode in ReadOnly."
      },
      {
        term: "Managed Instance Groups (MIGs)",
        definition: "Homogeneous collections of VMs created from an Instance Template with support for automated rolling updates, autoscaling (CPU/metric), and autohealing."
      },
      {
        term: "Regional MIGs for High Availability",
        definition: "Distributes VM instances across 3 zones in a single region to withstand single-zone failure."
      }
    ],
    api_names: ["compute.googleapis.com"],
    limits: ["Local SSD data is lost when the VM instance is stopped or terminated."],
    code_examples: [
      "gcloud compute instances create app-server --zone=us-central1-a --machine-type=e2-medium --metadata=startup-script='#!/bin/bash\napt-get update && apt-get install -y nginx'",
      "gcloud compute instance-templates create app-template --machine-type=e2-standard-2 --tags=http-server",
      "gcloud compute instance-groups managed create app-mig --template=app-template --size=3 --zones=us-central1-a,us-central1-b,us-central1-c"
    ]
  },
  {
    objective_id: "obj-gcp-302",
    url: "https://cloud.google.com/kubernetes-engine/docs/deploy-app-cluster",
    title: "Deploying and Implementing Google Kubernetes Engine (GKE) Resources",
    summary: "GKE provides managed Kubernetes clusters. Autopilot mode automates node provisioning and cluster hardening, while Standard mode offers full control over underlying node pool infrastructure.",
    learning_outcomes: [
      "Create GKE Standard and GKE Autopilot clusters across zonal and regional configurations",
      "Deploy containerized workloads using kubectl manifests (Deployments, Services, ConfigMaps, Secrets)",
      "Configure Horizontal Pod Autoscaler (HPA) and Cluster Autoscaler for dynamic scaling"
    ],
    key_concepts: [
      {
        term: "GKE Autopilot vs Standard",
        definition: "Autopilot manages node infrastructure, OS patching, and security hardening; users pay per pod resource request. Standard gives access to node pools, machine types, and custom Daemons."
      },
      {
        term: "Node Pools",
        definition: "Subsets of machines within a Standard cluster with identical configuration (machine type, labels, taints, preemptible flags)."
      },
      {
        term: "Horizontal Pod Autoscaler (HPA)",
        definition: "Kubernetes controller that automatically scales pod replicas up or down based on observed CPU utilization or custom Prometheus metrics."
      },
      {
        term: "Workload Identity",
        definition: "Binds Kubernetes ServiceAccounts to Google Cloud IAM Service Accounts, allowing pods to authenticate to GCP APIs without stored secret keys."
      }
    ],
    api_names: ["container.googleapis.com"],
    limits: ["Autopilot enforces strict resource limits, security contexts, and prevents privileged containers."],
    code_examples: [
      "gcloud container clusters create-auto my-autopilot-cluster --region=us-central1",
      "gcloud container clusters get-credentials my-autopilot-cluster --region=us-central1",
      "kubectl apply -f deployment.yaml",
      "kubectl autoscale deployment web-app --min=2 --max=10 --cpu-percent=80"
    ]
  },
  {
    objective_id: "obj-gcp-303",
    url: "https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-service",
    title: "Deploying and Implementing Cloud Run and Cloud Functions",
    summary: "Cloud Run executes serverless container workloads triggered via HTTP or Eventarc events. Cloud Functions provides event-driven serverless code execution with automatic scaling.",
    learning_outcomes: [
      "Deploy container images from Artifact Registry to Cloud Run with customized concurrency and memory limits",
      "Deploy 2nd generation Cloud Functions triggered by Cloud Storage, Pub/Sub, and Firestore events",
      "Configure Serverless VPC Access connectors to connect serverless functions to private VPC databases"
    ],
    key_concepts: [
      {
        term: "Cloud Run Concurrency",
        definition: "The maximum number of simultaneous requests a single container instance can process (default 80, up to 1000), reducing cold starts."
      },
      {
        term: "Min & Max Instances",
        definition: "Setting min-instances=1 keeps a warm instance to eliminate cold starts; max-instances caps scaling to protect backend databases from overload."
      },
      {
        term: "Cloud Functions (2nd Gen)",
        definition: "Built on Cloud Run and Eventarc, supporting up to 60-minute processing timeouts and request concurrency."
      },
      {
        term: "Serverless VPC Access Connector",
        definition: "A managed bridge allowing Cloud Run and Cloud Functions to route requests to internal RFC 1918 VPC IPs (e.g., private Cloud SQL)."
      }
    ],
    api_names: ["run.googleapis.com", "cloudfunctions.googleapis.com", "artifactregistry.googleapis.com"],
    limits: ["Cloud Run container startup timeout is 240 seconds; default request timeout is 300 seconds (configurable to 3600s)."],
    code_examples: [
      "gcloud run deploy api-service --image=us-central1-docker.pkg.dev/my-proj/repo/api:v1 --region=us-central1 --allow-unauthenticated --concurrency=80 --min-instances=1",
      "gcloud functions deploy process-order --gen2 --runtime=nodejs20 --trigger-topic=orders-topic --region=us-central1"
    ]
  },
  {
    objective_id: "obj-gcp-304",
    url: "https://cloud.google.com/sql/docs/mysql/create-instance",
    title: "Deploying and Implementing Managed Data Solutions",
    summary: "Deploying relational and analytical data systems includes provisioning Cloud SQL instances with High Availability, configuring BigQuery datasets, and setting Cloud Storage bucket policies.",
    learning_outcomes: [
      "Provision Cloud SQL instances with regional High Availability (HA) failover replicas and automated backups",
      "Create BigQuery datasets, partition tables by date/timestamp, and configure clustering keys",
      "Manage Cloud Storage bucket versioning, Object Lifecycle Management rules, and Uniform Bucket-Level Access"
    ],
    key_concepts: [
      {
        term: "Cloud SQL High Availability (HA)",
        definition: "Synchronous replication between a primary and standby instance in separate zones; automated failover in under 60 seconds."
      },
      {
        term: "BigQuery Table Partitioning & Clustering",
        definition: "Partitioning divides large tables into segments by date/integer; clustering sorts data based on key columns, drastically reducing query scan costs."
      },
      {
        term: "Object Lifecycle Management",
        definition: "Declarative rules that automatically transition storage classes (e.g. Standard -> Nearline after 30 days) or delete expired objects."
      },
      {
        term: "Uniform Bucket-Level Access",
        definition: "Disables individual object ACLs and enforces unified IAM role evaluation across the entire storage bucket."
      }
    ],
    api_names: ["sqladmin.googleapis.com", "bigquery.googleapis.com", "storage.googleapis.com"],
    limits: ["Cloud SQL automated backups require binary logging to be enabled for point-in-time recovery (PITR)."],
    code_examples: [
      "gcloud sql instances create prod-db --database-version=POSTGRES_15 --tier=db-custom-4-16384 --region=us-central1 --availability-type=REGIONAL --backup-start-time=02:00",
      "bq mk --dataset --location=US my_analytics_dataset",
      "gcloud storage buckets update gs://my-bucket --enable-autoclass"
    ]
  },
  {
    objective_id: "obj-gcp-401",
    url: "https://cloud.google.com/compute/docs/instances/stop-start-instance",
    title: "Managing Compute Engine VM Lifecycle and Storage",
    summary: "Operational management of Compute Engine entails state transitions (start, stop, suspend, reset), taking persistent disk snapshots, resizing machine types, and configuring secure SSH access via OS Login.",
    learning_outcomes: [
      "Manage VM lifecycle states and understand billing implications of stopped vs suspended instances",
      "Schedule and execute persistent disk snapshots and create reusable Machine Images",
      "Configure OS Login for centralized SSH key management and IAM-based VM authentication"
    ],
    key_concepts: [
      {
        term: "STOP vs SUSPEND",
        definition: "STOP flushes memory and deallocates vCPU/RAM (only disk storage is billed); SUSPEND saves RAM state to disk for rapid resumption."
      },
      {
        term: "Persistent Disk Snapshots",
        definition: "Incremental, differential backups stored globally in Cloud Storage across multi-regions with automatic encryption."
      },
      {
        term: "OS Login",
        definition: "Integrates Google Workspace / Cloud Identity credentials with Linux user accounts on VMs, replacing static authorized_keys files with IAM roles (`roles/compute.osLogin`)."
      },
      {
        term: "Live Migration",
        definition: "Google Cloud automatically migrates running VM instances to another host machine during infrastructure maintenance with zero downtime."
      }
    ],
    api_names: ["compute.googleapis.com"],
    limits: ["VM instance machine types can only be modified when the instance is in the STOPPED state."],
    code_examples: [
      "gcloud compute instances stop web-vm --zone=us-central1-a",
      "gcloud compute instances set-machine-type web-vm --machine-type=e2-standard-4 --zone=us-central1-a",
      "gcloud compute instances start web-vm --zone=us-central1-a",
      "gcloud compute disks snapshot data-disk --snapshot-names=backup-snapshot-1 --zone=us-central1-a"
    ]
  },
  {
    objective_id: "obj-gcp-402",
    url: "https://cloud.google.com/kubernetes-engine/docs/how-to/scaling-apps",
    title: "Managing and Operating Google Kubernetes Engine (GKE) Workloads",
    summary: "Day-2 GKE operations include inspecting pod health, rolling out zero-downtime application updates, managing persistent volumes, and upgrading cluster control planes and node pools.",
    learning_outcomes: [
      "Inspect running cluster resources, pod events, and logs using kubectl and Google Cloud Logging",
      "Execute rolling deployments and rollbacks with canary verification",
      "Upgrade GKE cluster control plane and worker node pools using maintenance windows and surge upgrades"
    ],
    key_concepts: [
      {
        term: "Rolling Updates & Surge Upgrades",
        definition: "Surge upgrades create temporary extra nodes during node pool upgrades to maintain application capacity and prevent downtime."
      },
      {
        term: "Maintenance Windows & Exclusions",
        definition: "Designated time windows that restrict automated GKE control plane and node pool upgrades to non-peak hours."
      },
      {
        term: "kubectl rollout",
        definition: "Command suite (`kubectl rollout status`, `kubectl rollout undo`) to monitor and safely reverse failed application deployments."
      },
      {
        term: "PersistentVolumeClaim (PVC)",
        definition: "A request for storage dynamically provisioned as a Compute Engine Persistent Disk via the GKE CSI driver."
      }
    ],
    api_names: ["container.googleapis.com"],
    limits: ["Node pool upgrades drain pods one node at a time following PodDisruptionBudgets (PDB)."],
    code_examples: [
      "kubectl get pods -n production -o wide",
      "kubectl rollout restart deployment/order-service -n production",
      "kubectl rollout undo deployment/order-service --to-revision=2 -n production",
      "gcloud container clusters upgrade my-cluster --master --region=us-central1"
    ]
  },
  {
    objective_id: "obj-gcp-403",
    url: "https://cloud.google.com/run/docs/managing/traffic-routing",
    title: "Managing Cloud Run Revisions and Traffic Splitting",
    summary: "Cloud Run maintains an immutable history of revisions. Operators manage blue/green deployments, canary testing via traffic percentage splits, and secure access using Secret Manager.",
    learning_outcomes: [
      "Perform traffic splitting between multiple Cloud Run revisions for canary and blue-green releases",
      "Inject sensitive configuration values and API keys securely using Google Secret Manager",
      "Configure custom domain mappings and manage ingress traffic access boundaries"
    ],
    key_concepts: [
      {
        term: "Immutable Revisions",
        definition: "Every deployment creates a unique, point-in-time container configuration revision that cannot be modified."
      },
      {
        term: "Traffic Splitting",
        definition: "Routing a percentage of incoming live HTTP traffic to a canary revision (e.g. 10% to v2, 90% to v1) before 100% rollout."
      },
      {
        term: "Secret Manager Integration",
        definition: "Mounting secrets as environment variables or volume files directly into the container runtime without hardcoding in images."
      },
      {
        term: "Ingress Settings",
        definition: "Restricting traffic to 'All' (public internet), 'Internal' (VPC & Cloud Load Balancing only), or 'Internal and Cloud Load Balancing'."
      }
    ],
    api_names: ["run.googleapis.com", "secretmanager.googleapis.com"],
    limits: ["Traffic splitting requires explicit revision tags or revision IDs."],
    code_examples: [
      "gcloud run services update-traffic api-service --to-revisions=api-service-00002-abc=10,api-service-00001-xyz=90 --region=us-central1",
      "gcloud run services update api-service --set-secrets=DB_PASS=db-password:latest --region=us-central1"
    ]
  },
  {
    objective_id: "obj-gcp-404",
    url: "https://cloud.google.com/monitoring/dashboards",
    title: "Managing Observability: Monitoring, Logging, and Alerting",
    summary: "Cloud Operations Suite provides full-stack visibility. Operators configure custom metric dashboards, alert notification channels, log-based metrics, and log sinks for compliance auditing.",
    learning_outcomes: [
      "Build Cloud Monitoring dashboards with custom metrics, CPU/memory widgets, and uptime checks",
      "Configure Alerting Policies with notification channels (Email, PagerDuty, Slack, Webhook)",
      "Create Log Router sinks to export audit and application logs to BigQuery, Cloud Storage, or Pub/Sub"
    ],
    key_concepts: [
      {
        term: "Cloud Monitoring Alert Policies",
        definition: "Conditions that evaluate time-series metrics against thresholds (e.g. CPU > 85% for 5 mins) and trigger incident workflows."
      },
      {
        term: "Log-Based Metrics",
        definition: "Custom counters and distribution metrics extracted from log entry text messages (e.g. HTTP 500 error counts)."
      },
      {
        term: "Log Router & Sinks",
        definition: "Filters that route log entries to long-term storage (Cloud Storage), analytics (BigQuery), or streaming queues (Pub/Sub)."
      },
      {
        term: "Cloud Trace & Cloud Profiler",
        definition: "Distributed tracing tools that pinpoint latency bottlenecks and CPU/memory hotspots across distributed microservices."
      }
    ],
    api_names: ["monitoring.googleapis.com", "logging.googleapis.com", "cloudtrace.googleapis.com"],
    limits: ["Logs stored in Cloud Logging _Default bucket are retained for 30 days unless exported via sinks."],
    code_examples: [
      "gcloud logging sinks create bigquery-audit-sink bigquery.googleapis.com/projects/my-proj/datasets/audit_logs --log-filter='resource.type=\"gce_instance\" AND severity>=WARNING'",
      "gcloud monitoring channels create --display-name=\"On-Call Team\" --type=email --channel-content=email_address=\"oncall@example.com\""
    ]
  },
  {
    objective_id: "obj-gcp-501",
    url: "https://cloud.google.com/iam/docs/understanding-roles",
    title: "Managing Identity and Access Management (IAM) and Roles",
    summary: "Google Cloud IAM governs authorization across resources. Administrators assign Primitive, Predefined, and Custom roles adhering to the principle of least privilege, with conditional access policies.",
    learning_outcomes: [
      "Differentiate Primitive roles (Owner, Editor, Viewer) from granular Predefined and Custom IAM roles",
      "Understand IAM policy inheritance from Organization down through Folders and Projects to individual resources",
      "Apply IAM Conditions for context-aware access based on IP range, time of day, or resource tag"
    ],
    key_concepts: [
      {
        term: "Primitive vs Predefined Roles",
        definition: "Primitive roles apply coarse permissions across all resources; Predefined roles provide granular, service-specific permissions (e.g. Compute Network Admin)."
      },
      {
        term: "Policy Inheritance (Additive)",
        definition: "Permissions granted at higher levels (Organization or Folder) cannot be revoked at child levels; effective permissions are the union of all bindings."
      },
      {
        term: "IAM Conditions",
        definition: "Attribute-based access control (ABAC) expressions that grant permissions conditionally (e.g. access expires on a specific date, or only from office IP CIDR)."
      },
      {
        term: "Deny Policies",
        definition: "Explicit deny rules enforced across the hierarchy that override any allow permissions."
      }
    ],
    api_names: ["iam.googleapis.com"],
    limits: ["Custom roles cannot contain permissions that are restricted to Google-managed roles."],
    code_examples: [
      "gcloud projects add-iam-policy-binding my-project-id --member='user:alice@example.com' --role='roles/compute.networkAdmin'",
      "gcloud iam roles create customVMOperator --project=my-project-id --title=\"Custom VM Operator\" --permissions=compute.instances.start,compute.instances.stop,compute.instances.get"
    ]
  },
  {
    objective_id: "obj-gcp-502",
    url: "https://cloud.google.com/iam/docs/service-accounts-create",
    title: "Managing Service Accounts, Impersonation, and Keyless Access",
    summary: "Service accounts represent non-human identities used by applications and compute resources. Keyless authentication with Workload Identity and short-lived tokens minimizes security risks.",
    learning_outcomes: [
      "Create and configure User-Managed Service Accounts with least-privilege role bindings",
      "Attach service accounts to Compute Engine instances, Cloud Run services, and GKE workloads",
      "Implement keyless authentication via Workload Identity Federation instead of exporting downloadable JSON service account keys"
    ],
    key_concepts: [
      {
        term: "User-Managed vs Default Service Accounts",
        definition: "Default service accounts created by GCP have broad Editor permissions; best practice is to create User-Managed service accounts with minimal required roles."
      },
      {
        term: "Service Account User Role (`roles/iam.serviceAccountUser`)",
        definition: "Required by developers to attach a service account to a VM or Cloud Run service upon creation."
      },
      {
        term: "Workload Identity Federation",
        definition: "Exchanges OIDC tokens from external providers (AWS, GitHub Actions, Azure AD) for temporary Google Cloud credentials without static keys."
      },
      {
        term: "Service Account Impersonation",
        definition: "Allows authorized users to temporarily assume a service account's identity to generate short-lived access tokens via `roles/iam.serviceAccountTokenCreator`."
      }
    ],
    api_names: ["iam.googleapis.com", "sts.googleapis.com"],
    limits: ["Downloadable JSON private keys never expire automatically and represent a high security vulnerability if leaked."],
    code_examples: [
      "gcloud iam service-accounts create app-runner --display-name=\"Application Runner Service Account\"",
      "gcloud projects add-iam-policy-binding my-project-id --member='serviceAccount:app-runner@my-project-id.iam.gserviceaccount.com' --role='roles/storage.objectViewer'",
      "gcloud compute instances create secure-vm --service-account=app-runner@my-project-id.iam.gserviceaccount.com --scopes=cloud-platform"
    ]
  },
  {
    objective_id: "obj-gcp-503",
    url: "https://cloud.google.com/logging/docs/audit",
    title: "Viewing, Filtering, and Exporting Cloud Audit Logs",
    summary: "Cloud Audit Logs record 'who did what, where, and when'. Administrators monitor Admin Activity, Data Access, System Events, and Policy Denied events for compliance and security auditing.",
    learning_outcomes: [
      "Distinguish between the 4 types of Cloud Audit Logs and understand default retention periods",
      "Enable and configure Data Access audit logs for sensitive storage and database services",
      "Query audit logs using Google Cloud Logging Logs Explorer and export via sinks"
    ],
    key_concepts: [
      {
        term: "Admin Activity Logs",
        definition: "Record configuration changes or administrative actions (e.g. creating a VM, modifying IAM policy); always enabled, free of charge, retained for 400 days."
      },
      {
        term: "Data Access Logs",
        definition: "Record API calls that read or write user-provided data (e.g. reading Cloud Storage objects, querying BigQuery tables); disabled by default (except BigQuery) to manage volume."
      },
      {
        term: "System Event & Policy Denied Logs",
        definition: "System Events log Google-initiated administrative actions (e.g. live migration); Policy Denied logs record requests rejected by Organization Policies."
      },
      {
        term: "Audit Log Immutability",
        definition: "Audit logs cannot be altered, modified, or deleted by any user or administrator within Google Cloud."
      }
    ],
    api_names: ["logging.googleapis.com"],
    limits: ["Data Access logs can generate massive log volumes and incur logging ingestion and storage charges."],
    code_examples: [
      "gcloud logging read 'logName:\"logs/cloudaudit.googleapis.com%2Factivity\" AND protoPayload.methodName:\"v1.compute.instances.insert\"' --limit=10 --format=json"
    ]
  }
];

export function seedGCPSources() {
  const db = getDb();
  console.log(`Seeding ${GCP_SOURCES.length} official documentation sources for Google Cloud ACE...`);

  for (const src of GCP_SOURCES) {
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
    const sourceId = `src-gcp-${src.objective_id.replace("obj-gcp-", "")}`;

    // Delete existing source for clean state
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

  console.log(`[+] Successfully seeded all ${GCP_SOURCES.length} Google Cloud ACE sources into scraped_sources.`);
}

if (require.main === module) {
  seedGCPSources();
}
