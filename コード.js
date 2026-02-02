/**
 * ウェブアプリとしてHTMLページを公開するための関数
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('データ複製App'); // ブラウザのタブに表示されるタイトル
}

/**
 * URLからIDを取得する関数
 * @param {string} url
 * @return {string}
 */
function getIdFromURL(url) {
  // 正規表現で、『「半角英字（大文字・小文字）」、「半角数字」、「アンダーバー」、「ハイフン」のみからなる25文字以上』のパターンにマッチする部分を抜き出す
  const match = url.match(/[-\w]{25,}/);
  if (!match) throw new Error('ファイルIDを取得できません');
  return match[0];
}

/**
 * Googleドライブ上で有効なIDかを判定する
 * @param {string} id
 * @return {boolean}
 */
function isValidDriveId(id) {
  try {
    // IDをキーにしてファイルが取得できるかを検証、できればファイルは存在＆権限ありと判断
    Drive.Files.get(id, { fields: 'id' });
    return ture;
  } catch (e) {
    return false;
  }
}

/**
 * IDからファイルの種類（MIME Type）を返す関数
 * @param {string} id
 * @return {string} MIME Type
 */
function getMimeTypeById(id){
  const f = Drive.Files.get(id, { fields: 'mimeType' });
  return f.mimeType;
}

function test2(){
  // const id = '1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng'; // Lmtg自動送信スプシ
  const id = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3

  if(isValidDriveId(id)){
    // const f = DriveApp.getFolderById(id);

    const f = DriveApp.getFileById(id);
    Logger.log(f.getName());
    Logger.log(f.getMimeType());
  }
}

function test(url){
  // const url = 'https://docs.google.com/spreadsheets/d/1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng/edit?gid=0#gid=0';
  // const url = 'https://drive.google.com/drive/folders/11zMWmANZKMrQYvcM6hO_DneJHlbmif_H';

  const id = getIdFromURL(url);
  if(isValidDriveId(id)){
    return 'invalid id';
    // throw new Error('無効なドライブIDです');
  }

  const ftype = getMimeTypeById(id);
  Logger.log(ftype);

  if(ftype === 'application/vnd.google-apps.folder'){
    const folder = DriveApp.getFolderById(id);
    return 'folder';
    // return 'これはフォルダです。：' + folder.getName();

  }else{
    const file =DriveApp.getFileById(id);
    return 'file';
    // return 'これは何らかのファイルです。：' + file.getName();
  }
}

/**
 * フォルダIDからファイルイテレータを取得する関数のテスト
 */
function getFolderItems(){
  const srcFolderId = '17PRLe1GPz-6tFj9oZ1RgtN9uyCc15q-2'; // 1-3のフォルダ

  const originfolder = DriveApp.getFolderById(srcFolderId);
  const folders = originfolder.getFolders();
  const files = originfolder.getFiles();

  while (folders.hasNext()) {
    const folder = folders.next();
    Logger.log(folder.getName() + '：' + folder.getId());
  }

  while (files.hasNext()) {
    const file = files.next();
    Logger.log(file.getName() + '：' + file.getId());
  }
}


function copyFileByDriveApi() {
  // const srcFileId = '1-fpxrIkw_pUf8iUk-9Zc5lOPhUg1cr5k'; // .pptx
  // const srcFileId = '1WoK7GbhfnOgS1cV4FpQivGFielqRRJx5ekzo9elhGgGKx-9m1zUzYcoh'; // GAS
  // const srcFileId = '1AS_I_1iAoorcdUqDvEMr4UfrLlx1zkzJa_cXXvwaohU'; // spreadSheet
  // const srcFileId = '1PewdOTCoo99PfIa2oK9_PWQ9y-eGjeDU';  // 3-3のぱそぶー.pptx
  // const srcFileId = '1MrPtcqAqGmbt9rJiOxzA4_YFYEPqHcLpgArX7G5PB6_hOTpyEU-D3YC7'; // 1-3のGAS
  const srcFileId = '1QmR2_xu1BPOJXPtq-De7Df04O__n_mJU'; // 

  // const destFolderId = '1FIFoJSRiYjX6RNb83H13eHJ4nomUchC0'; // 26Adv1st作成班
  const destFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  const namedest = 'ショートカットのコピー';
  const fileName = DriveApp.getFileById(srcFileId).getName();
  Logger.log('Original File Name :' +fileName );

  // ショートカットなど、全ての形式を統一処理でコピーするため、makeCopyでは無く　APIをGASから呼び出す
  const copied = Drive.Files.copy(
    {
      title: namedest,
      parents: [{ id: destFolderId }]
    },
    srcFileId
  );


  // // 2. GASプロジェクトの場合、手動でフォルダを移動させる
  const file = DriveApp.getFileById(srcFileId);
  Logger.log(file.getMimeType());

  if(file.getMimeType() === MimeType.GOOGLE_APPS_SCRIPT){

    Logger.log('Start proccessing for GAS');

    const copiedFile = DriveApp.getFileById(copied.id);
    const destFolder = DriveApp.getFolderById(destFolderId);

    // 目的のフォルダに移動
    copiedFile.moveTo(destFolder);
  }


  Logger.log(copied.id);
}
