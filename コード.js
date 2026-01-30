/**
 * ウェブアプリとしてHTMLページを公開するための関数
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('データ複製App'); // ブラウザのタブに表示されるタイトル
}


function copyFileByDriveApi() {
  // const srcFileId = '1-fpxrIkw_pUf8iUk-9Zc5lOPhUg1cr5k'; // .pptx
  // const srcFileId = '1WoK7GbhfnOgS1cV4FpQivGFielqRRJx5ekzo9elhGgGKx-9m1zUzYcoh'; // GAS
  // const srcFileId = '1AS_I_1iAoorcdUqDvEMr4UfrLlx1zkzJa_cXXvwaohU'; // spreadSheet
  // const srcFileId = '1PewdOTCoo99PfIa2oK9_PWQ9y-eGjeDU';  // 3-3のぱそぶー.pptx
  const srcFileId = '1MrPtcqAqGmbt9rJiOxzA4_YFYEPqHcLpgArX7G5PB6_hOTpyEU-D3YC7'; // 1-3のGAS

  // const destFolderId = '1FIFoJSRiYjX6RNb83H13eHJ4nomUchC0'; // 26Adv1st作成班
  const destFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  const namedest = '自己紹介Bookのコピー';
  const fileName = DriveApp.getFileById(srcFileId).getName();
  Logger.log(fileName);

// ショートカットなど、全ての形式を統一処理でコピーするため、makeCopyでは無く　APIをGASから呼び出す
  const copied = Drive.Files.copy(
    {
      title: namedest,
      parents: [{ id: destFolderId }]
    },
    srcFileId
  );

  const file = DriveApp.getFileById(srcFileId);
  Logger.log(file.getMimeType());

  if(file.getMimeType() === MimeType.GOOGLE_APPS_SCRIPT){

    Logger.log('Start proccessing for GAS');

    // 2. GASプロジェクトの場合、手動でフォルダを移動させる
    const copiedFile = DriveApp.getFileById(copied.id);
    const destFolder = DriveApp.getFolderById(destFolderId);

    // 目的のフォルダに移動
    copiedFile.moveTo(destFolder);
  }

  Logger.log(copied.id);
}

/**
 * HTMLから呼び出されるGAS関数（例：メッセージを返す）
 * @param {string} name HTMLから渡される引数
 * @returns {string} GASからHTMLに返すメッセージ
 */
function getGreetingMessage(name) {
  return 'こんにちは、' + name + 'さん！GASからのメッセージです。';
}