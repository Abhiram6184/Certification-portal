import { DATABRICKS_CERTIFICATION_TITLES } from './constants';

export const normalizeTitle = (title: string) => (title || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const getIssuerFromTitle = (title: string): string => {
    const lowerTitle = (title || '').toLowerCase();
    if (lowerTitle.includes('databricks')) return 'Databricks';
    if (lowerTitle.includes('microsoft') || lowerTitle.includes('azure')) return 'Microsoft';
    if (lowerTitle.includes('google')) return 'Google';
    return 'Others';
};

export const AVAILABLE_ISSUERS = ['All', 'Databricks', 'Microsoft', 'Google', 'Others'];
export const KNOWN_ISSUERS = ['Databricks', 'Microsoft', 'Google'];
export const AVAILABLE_COLLECTIONS = ['All', 'Certificates', 'Badges'];

// Create a set of normalized titles for efficient lookup.
export const NORMALIZED_CERTIFICATION_TITLES = new Set(
    DATABRICKS_CERTIFICATION_TITLES.map(normalizeTitle)
);
