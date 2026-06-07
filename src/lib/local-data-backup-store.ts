import {
  bulkPutEntryOverrides,
  getLibraryEntriesRecord,
  listEntryOverrides,
  listLibraryDecks,
  saveLibraryDecks,
  saveLibraryEntries,
} from './download-store';
import { downloadBlob } from './import-export/export-library';
import {
  buildLocalDataBackupFileName,
  collectLocalDataBackupDocument,
  parseLocalDataBackupText,
  restoreLocalDataBackupDocument,
  summarizeLocalDataBackup,
  type LocalDataBackupDocument,
  type LocalDataBackupParseResult,
  type LocalDataBackupSummary,
} from './local-data-backup';
import {
  bulkPutCardStates,
  bulkPutSessionLogs,
  bulkPutStreakMeta,
  getAllCardStates,
  getAllSessionLogs,
  getStreakMeta,
} from './srs-store';

export async function createLocalDataBackupDocument(): Promise<LocalDataBackupDocument> {
  return collectLocalDataBackupDocument({
    listLibraryDecks,
    getLibraryEntriesRecord,
    listEntryOverrides,
    getAllCardStates,
    getAllSessionLogs,
    getStreakMeta,
  });
}

export async function downloadLocalDataBackup(): Promise<LocalDataBackupSummary> {
  const document = await createLocalDataBackupDocument();
  const text = `${JSON.stringify(document, null, 2)}\n`;
  downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), buildLocalDataBackupFileName(document.createdAt));
  return summarizeLocalDataBackup(document);
}

export async function readLocalDataBackupFile(file: File): Promise<LocalDataBackupParseResult> {
  return parseLocalDataBackupText(await file.text());
}

export async function restoreLocalDataBackupToStorage(
  document: LocalDataBackupDocument,
): Promise<LocalDataBackupSummary> {
  return restoreLocalDataBackupDocument(document, {
    saveLibraryDecks,
    saveLibraryEntries,
    bulkPutEntryOverrides,
    bulkPutCardStates,
    bulkPutSessionLogs,
    bulkPutStreakMeta,
  });
}
