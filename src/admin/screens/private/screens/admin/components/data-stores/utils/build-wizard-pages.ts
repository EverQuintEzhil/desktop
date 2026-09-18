import type { WizardFormPage } from '@/admin/components/wizard';

import {
    WizardConfigureCronStep,
    WizardConfigureConnectionStep,
    WizardConfigureFieldsStep,
    WizardConfigureFilesFoldersStep,
    WizardConfigureSpecificationStep,
    WizardConfigureTemplatesStep,
    WizardConfigureWeblinksStep,
    WizardDataExplorerStep,
    WizardDataStoreStep,
} from '../components';
import type { WizardCommonData } from '../types';

export const buildWizardPages = (commonData: WizardCommonData): WizardFormPage[] => {
    const provider = commonData?.dataStore?.provider;
    const dontSkipCron = commonData?.dontSkipCron;
    const dontSkipEmbeddingFields = commonData?.dontSkipEmbeddingFields;

    const dataStoreStep: WizardFormPage = {
        id: 'data-store',
        title: 'Data Store',
        defaultCanGoNext: false,
        component: WizardDataStoreStep,
    };

    if (provider === 'files') {
        return [dataStoreStep];
    }

    // Weblinks is a two-step flow: create the store, then add the links. No cron step.
    if (provider === 'weblinks') {
        return [
            dataStoreStep,
            {
                id: 'configure-weblinks',
                title: 'Configure Web Links',
                defaultCanGoNext: false,
                component: WizardConfigureWeblinksStep,
            },
        ];
    }

    const cronStep = [] as WizardFormPage[];

    if (dontSkipCron) {
        cronStep.push({
            id: 'configure-cron',
            title: 'Configure Cron',
            defaultCanGoNext: false,
            component: WizardConfigureCronStep,
        });
    }

    const providerStep =
        provider === 'custom'
            ? {
                  id: 'configure-specification',
                  title: 'Configure the Specification',
                  defaultCanGoNext: false,
                  component: WizardConfigureSpecificationStep,
              }
            : {
                  id: 'configure-connection',
                  title: 'Configure the Connection',
                  defaultCanGoNext: false,
                  component: WizardConfigureConnectionStep,
              };

    const embeddingFieldsStep =
        provider !== 's3' && provider !== 'azure-blob-storage' && provider !== 'sharepoint'
            ? {
                  id: 'configure-fields',
                  title: 'Configure Embedding Fields',
                  defaultCanGoNext: false,
                  lockFooterToPageCanGoNext: true,
                  component: WizardConfigureFieldsStep,
              }
            : {
                  id: 'configure-fields',
                  title: 'Configure Embedding Files & Folders',
                  defaultCanGoNext: false,
                  lockFooterToPageCanGoNext: true,
                  component: WizardConfigureFilesFoldersStep,
              };

    const embeddingFieldsPages = [] as WizardFormPage[];

    if (dontSkipEmbeddingFields !== false) {
        embeddingFieldsPages.push(embeddingFieldsStep);
    }

    const dataExplorerStep = [] as WizardFormPage[];

    if (provider !== 'azure-blob-storage' && provider !== 'sharepoint') {
        dataExplorerStep.push({
            id: 'data-explorer',
            title: 'Data Explorer',
            defaultCanGoNext: true,
            component: WizardDataExplorerStep,
        });
    }

    return [
        dataStoreStep,
        providerStep,
        ...dataExplorerStep,
        ...embeddingFieldsPages,
        ...cronStep,
        {
            id: 'configure-templates',
            title: 'Configure Templates',
            defaultCanGoNext: false,
            component: WizardConfigureTemplatesStep,
        },
    ];
};
