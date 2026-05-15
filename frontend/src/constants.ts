
import { Certification } from './types';
import { v4 as uuidv4 } from 'uuid';

// Certification mapping for different providers
export const certificationMap = {
    "Databricks": [
        "Data Analyst Associate",
        "Data Engineer Associate",
        "Data Engineer Professional",
        "Machine Learning Engineer Associate",
        "Machine Learning Engineer Professional",
        "Gen-AI Engineer Associate",
        "Spark Developer Associate"
    ],
    "Microsoft Azure": [
        "Azure Fundamentals (AZ-900)",
        "Azure Network Engineer (AZ-700)",
        "Azure Security Engineer (AZ-500)",
        "Azure Solutions Architect (AZ-305)",
        "Azure Administrator (AZ-104)",
        "Azure DevOps Engineer (AZ-400)",
        "Azure Developer (AZ-204)",
        "Azure AI Engineer (AI-102)",
        "Data Fundamentals (DP-900)",
        "Azure Data Scientist (DP-100)",
        "Data Analyst (DA-100)",
        "Data Engineer (DP-203)"
    ],
    "AWS Certifications": [
        "AWS Cloud Practitioner",
        "AWS Certified AI Practitioner",
        "AWS Certified ML Engineer",
        "AWS Certified Solutions Architect – Associate",
        "AWS Certified SysOps Administrator – Associate",
        "AWS Certified Developer – Associate",
        "AWS Certified Data Engineer – Associate",
        "AWS Certified DevOps Engineer – Professional",
        "AWS Certified Solutions Architect – Professional",
        "AWS Certified ML – Specialty",
        "AWS Certified Advanced Networking – Specialty",
        "AWS Certified Security – Specialty"
    ],
    "Google": [
        "Google Data Analytics",
        "Google Cybersecurity",
        "Google UX Design",
        "Google Advanced Data Analytics",
        "Google Business Intelligence",
        "Google AI Essentials",
        "Google Prompting Essentials"
    ]
};

const CERTIFICATION_URLS: Record<string, string> = {
    // Databricks
    "Data Analyst Associate": "https://www.databricks.com/learn/certification/data-analyst-associate",
    "Data Engineer Associate": "https://www.databricks.com/learn/certification/data-engineer-associate",
    "Data Engineer Professional": "https://www.databricks.com/learn/certification/data-engineer-professional",
    "Machine Learning Engineer Associate": "https://www.databricks.com/learn/certification/machine-learning-associate",
    "Machine Learning Engineer Professional": "https://www.databricks.com/learn/certification/machine-learning-professional",
    "Gen-AI Engineer Associate": "https://www.databricks.com/learn/certification/genai-engineer-associate",
    "Spark Developer Associate": "https://www.databricks.com/learn/certification/apache-spark-developer-associate",

    // Microsoft Azure
    "Azure Fundamentals (AZ-900)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/?practice-assessment-type=certification",
    "Azure Network Engineer (AZ-700)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-network-engineer-associate/?practice-assessment-type=certification",
    "Azure Security Engineer (AZ-500)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-security-engineer/?practice-assessment-type=certification",
    "Azure Solutions Architect (AZ-305)": "https://learn.microsoft.com/en-us/credentials/certifications/exams/az-305/",
    "Azure Administrator (AZ-104)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/?practice-assessment-type=certification",
    "Azure DevOps Engineer (AZ-400)": "https://learn.microsoft.com/en-us/credentials/certifications/devops-engineer/",
    "Azure Developer (AZ-204)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-developer/?practice-assessment-type=certification",
    "Azure AI Engineer (AI-102)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-engineer/?practice-assessment-type=certification",
    "Data Fundamentals (DP-900)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-data-fundamentals/?practice-assessment-type=certification",
    "Azure Data Scientist (DP-100)": "https://learn.microsoft.com/en-us/credentials/certifications/azure-data-scientist/?practice-assessment-type=certification",
    "Data Analyst (DA-100)": "https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/?practice-assessment-type=certification",
    "Data Engineer (DP-203)": "https://learn.microsoft.com/en-us/training/courses/dp-203t00",

    // AWS Certifications
    "AWS Cloud Practitioner": "https://aws.amazon.com/certification/certified-cloud-practitioner/",
    "AWS Certified AI Practitioner": "https://aws.amazon.com/certification/certified-ai-practitioner/",
    "AWS Certified ML Engineer": "https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/",
    "AWS Certified Solutions Architect – Associate": "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
    "AWS Certified SysOps Administrator – Associate": "https://aws.amazon.com/certification/certified-sysops-admin-associate/",
    "AWS Certified Developer – Associate": "https://aws.amazon.com/certification/certified-developer-associate/",
    "AWS Certified Data Engineer – Associate": "https://aws.amazon.com/certification/certified-data-engineer-associate/",
    "AWS Certified DevOps Engineer – Professional": "https://aws.amazon.com/certification/certified-devops-engineer-professional/",
    "AWS Certified Solutions Architect – Professional": "https://aws.amazon.com/certification/certified-solutions-architect-professional/",
    "AWS Certified ML – Specialty": "https://aws.amazon.com/certification/certified-machine-learning-specialty/",
    "AWS Certified Advanced Networking – Specialty": "https://aws.amazon.com/certification/certified-advanced-networking-specialty/",
    // "AWS Certified Security – Specialty": // No URL was provided for this one.

    // Google
    "Google Data Analytics": "https://www.skills.google/paths/420",
    "Google Cybersecurity": "https://grow.google/certificates/cybersecurity/",
    "Google UX Design": "https://www.skills.google/paths/2271",
    "Google Advanced Data Analytics": "https://grow.google/certificates/advanced-data-analytics/",
    "Google Business Intelligence": "https://grow.google/certificates/business-intelligence/",
    "Google AI Essentials": "https://www.skills.google/paths/2336",
    "Google Prompting Essentials": "https://grow.google/prompting-essentials/"
};


// Generate the list of available certifications directly from the certificationMap
// This ensures the "Available" tab is always in sync with the request form.
export const AVAILABLE_CERTIFICATIONS: Certification[] = Object.entries(certificationMap).flatMap(([vendor, names]) => {
    // Normalize vendor names to match filtering logic and logos
    let properVendor = vendor;
    if (vendor === "Microsoft Azure") properVendor = "Microsoft";
    if (vendor === "AWS Certifications") properVendor = "AWS";
    if (vendor === "Databricks") properVendor = "Databricks";


    return names.map(name => ({
        id: uuidv4(), // Generate a unique ID for each certification
        name: name,
        vendor: properVendor,
        duration: 'Self-paced', // Provide a sensible default
        validityYears: 2, // Provide a sensible default
        url: CERTIFICATION_URLS[name],
    }));
});


// Centralized badge images mapping with root-relative paths for Vite
export const BADGE_IMAGES: Record<string, string> = {
    // Databricks certifications
    'Databricks Certified Data Analyst Associate': '/components/badges/Databricks/Databricks-Certified-Data-Analyst-Associate.png',
    'Databricks Certified Data Engineer Associate': '/components/badges/Databricks/Databricks-Certified-Data-Engg-Associate.png',
    'Databricks Certified Data Engineer Professional': '/components/badges/Databricks/Databricks-Certified-Data-Engg-Professional.png',
    'Databricks Certified Machine Learning Associate': '/components/badges/Databricks/Databricks-ML-Engg-Associate.png',
    'Databricks Certified Machine Learning Professional': '/components/badges/Databricks/Databricks-ML-Engg-professional.png',
    'Databricks Certified Spark Developer Associate': '/components/badges/Databricks/Spark Developer Associate.png',
    'Partner Training - Solutions Architect Champion': '/components/badges/Databricks/databricks-solutions-architect.png',
    'Databricks Solutions Architect Champion': '/components/badges/Databricks/databricks-solutions-architect.png',
    'Databricks Certified Associate Developer for Apache Spark': '/components/badges/Databricks/Databricks-Certified-Associate-Developer-for-Apache-Spark.png',
    'Databricks Certified Associate Developer for Apache Spark 3.0': '/components/badges/Databricks/Databricks-Certified-Associate-Developer-for-Apache-Spark.png',
    'Databricks Certified Associate Developer for Apache Spark 2.4': '/components/badges/Databricks/Databricks-Certified-Associate-Developer-for-Apache-Spark.png',
    'Databricks Certified Generative AI Associate': '/components/badges/Databricks/Databricks-certified-generative-AI-associate.png',
    'Databricks Certified Associate ML Practitioner for Apache Spark 2.4': '/components/badges/Databricks/Databricks-Certified-Associate-ML-Practitioner-for-Apache-Spark-2.4.png',
    'Databricks Certified Generative AI Engineer Associate': '/components/badges/Databricks/Databricks-Certified-Generative-AI-Engineer-Associate.png',

    // Microsoft certifications
    'Microsoft Certified: Azure Administrator Associate': '/components/badges/microsoft/azure-administrator-associate-az-104.png',
    'Microsoft Certified: Azure AI Engineer Associate': '/components/badges/microsoft/Azure-Ai-Engineer-az-102.png',
    'Microsoft Certified: Data Analyst Associate': '/components/badges/microsoft/Azure-Data-Analyst-DA100.png',
    'Microsoft Certified: Azure Data Engineer Associate': '/components/badges/microsoft/azure-data-engineer-associate-dp-203.png',
    'Microsoft Certified: Azure Data Fundamentals': '/components/badges/microsoft/azure-data-fundamentals-dp-900.png',
    'Microsoft Certified: Azure Data Scientist Associate': '/components/badges/microsoft/azure-data-scientist-associate-dp-100.png',
    'Microsoft Certified: Azure Developer Associate': '/components/badges/microsoft/azure-developer-associate-az-204.png',
    'Microsoft Certified: Azure Fundamentals': '/components/badges/microsoft/azure-Fundamentals-az-900.png',
    'Microsoft Certified: Azure Network Engineer Associate': '/components/badges/microsoft/azure-network-engineer-associate-az-700.png',
    'Microsoft Certified: Azure Security Engineer Associate': '/components/badges/microsoft/azure-security-engineer-associate-az-500.png',
    'Microsoft Certified: Azure Solutions Architect Expert': '/components/badges/microsoft/Azure-Solution-Architect-az-305.png',
    'Microsoft Certified: DevOps Engineer Expert': '/components/badges/microsoft/CERT-Expert-DevOps-Engineer-az-400.png',

    // Google certifications
    'Google Advanced Data Analytics': '/components/badges/google/google-Adv-Data-Analytics.png',
};

export const DATABRICKS_CERTIFICATION_TITLES = [
    'Databricks Certified Data Engineer Associate',
    'Databricks Certified Associate ML Practitioner for Apache Spark 2.4',
    'Databricks Certified Associate Developer for Apache Spark 3.0',
    'Databricks Certified Associate Developer for Apache Spark 2.4',
    'Databricks Certified Data Analyst Associate',
    'Databricks Certified Machine Learning Associate',
    'Databricks Certified Generative AI Engineer Associate',
    'Databricks Certified Associate Developer for Apache Spark',
    'Databricks Certified Machine Learning Professional',
    'Databricks Certified Data Engineer Professional'
];
