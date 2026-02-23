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
    return true;
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

/**
 * IDから、ファイルに複製の権限があるかを判定する関数
 * @param {string} id
 * @return {boolean}
 */
function haveCopyPermission(id){
  const f = Drive.Files.get(id, { fields: 'capabilities(canCopy)' });
  return f.capabilities?.canCopy === true; // フォルダの場合は常にfalseになる
}

/**
 * コピーしたいファイルのIDから、保存先、ファイル名を指定してコピーする関数
 * @param {string} srcFileId コピーしたいファイルのID
 * @param {string} destFolderId コピー先のフォルダID
 * @param {string} [copiedFileName] コピー後のファイル名
 * @return {File} copiedFile コピー後のファイルのファイルオブジェクト
 */
function copyFileToDsestFolderById(srcFileId,destFolderId,copiedFileName = null){

  Logger.log('origin file name : ' + DriveApp.getFileById(srcFileId).getName());

  // 名前指定が無い場合は、元ファイルと同じ名前にする
  let fileName;
  Logger.log('input file name : ' + copiedFileName);
  if(copiedFileName){
    fileName = copiedFileName;
  }else{
    fileName = DriveApp.getFileById(srcFileId).getName();
  }
  Logger.log('created file name : ' + fileName);

  
  // ショートカットなど、全ての形式を統一処理でコピーするため、makeCopyでは無くDriveAPIをGASから呼び出す
  const copiedFile = Drive.Files.copy(
    {
      name: fileName,
      parents: [destFolderId]
    },
    srcFileId
  );

  Logger.log('copiedFile-mimeType : ' + copiedFile.mimeType);

  // スタンドアロン型のGASプロジェクトの場合は強制的にマイドライブに複製されるので、複製後に改めて移動
  if(copiedFile.mimeType === 'application/vnd.google-apps.script'){
    Logger.log('mime-type : gas');
    const f = DriveApp.getFileById(copiedFile.id);
    const destFolder = DriveApp.getFolderById(destFolderId);

    // 目的のフォルダに移動
    f.moveTo(destFolder);
  }

  Logger.log('copiedFile.id : ' + copiedFile.id);
  return copiedFile;
}

// フォームとリンクされているスプシをコピーした際に、余分にコピーされるフォームを削除する


/**
 * ショートカットを生成する関数
 */
function createDriveShortcut() {
  // const targetFileId = '1-fpxrIkw_pUf8iUk-9Zc5lOPhUg1cr5k'; // .pptx マイドライブ上の自己紹介ブック
  // const targetFileId = '1WoK7GbhfnOgS1cV4FpQivGFielqRRJx5ekzo9elhGgGKx-9m1zUzYcoh'; // GAS マイドライブのpractice
  // const targetFileId = '1AS_I_1iAoorcdUqDvEMr4UfrLlx1zkzJa_cXXvwaohU'; // spreadSheet
  // const targetFileId = '1PewdOTCoo99PfIa2oK9_PWQ9y-eGjeDU';  // 3-3のぱそぶー.pptx
  // const targetFileId = '1MrPtcqAqGmbt9rJiOxzA4_YFYEPqHcLpgArX7G5PB6_hOTpyEU-D3YC7'; // 1-3のGAS
  // const targetFileId = '1QmR2_xu1BPOJXPtq-De7Df04O__n_mJU'; // ショートカット
  // const targetFileId = '1tvC7Ai4HFHGnRiKJAhJ1skEfIYaJSotEsFygtEx9RvM'; // マイドライブ上のフォームにリンクされているスプシ
  // const targetFileId = '1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ'; // プライベートアカウントのマイドライブ上のダミーデータ
  // const targetFileId = '17PRLe1GPz-6tFj9oZ1RgtN9uyCc15q-2'; // 1-3のフォルダ
  const targetFileId = '1swkNaeoaiCBWhpctrmxojTtDAWIcBNSi' // 1-3のフォルダ（オーナー自分）

  const destFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  // const destFolderId = '1Cv6n4vgm_c4siFbFNrg00OorDjm6aSD3';
  const shortcutName = DriveApp.getFileById(targetFileId).getName();

  const shortcut = Drive.Files.create(
    {
      name: shortcutName,
      mimeType: 'application/vnd.google-apps.shortcut',
      parents: [destFolderId],
      shortcutDetails: {
        targetId: targetFileId
      }
    }
  );

  Logger.log(shortcut.id);
}

/**
 * ショートカットの名前取得テスト
 */
function getShortcutNameTest(){
  // const id = '1QmR2_xu1BPOJXPtq-De7Df04O__n_mJU'; // ショートカット
  const id = '1L9iumWUHtnq31EJfSkA-tQ4sWnGnWJr9'; // 2-1のショートカット

  const f = Drive.Files.get(id, { fields: 'name' });
  Logger.log(f.name);
}

// スプシから、リンク元のフォームを得るテスト
function isFormLinked(){
  const url = 'https://docs.google.com/spreadsheets/d/1jptLcpaUtOItdCuFi8DwAG10LnnnP2LDY5jvSZS6zUI/edit?gid=0#gid=0'; // フォームリンク無し
  // const url = 'https://docs.google.com/spreadsheets/d/1tvC7Ai4HFHGnRiKJAhJ1skEfIYaJSotEsFygtEx9RvM/edit?usp=sharing'; // フォームリンク有り
  const ss = SpreadsheetApp.openByUrl(url);
  const formUrl = ss.getFormUrl();
  if(formUrl){
    Logger.log('Linked Form: ' +formUrl);
    return true;
  }else{
    Logger.log('No Linked Form');
    return false;
  }
}

function test(){
  // const srcFileId = '1-fpxrIkw_pUf8iUk-9Zc5lOPhUg1cr5k'; // .pptx マイドライブ上の自己紹介ブック
  // const srcFileId = '1WoK7GbhfnOgS1cV4FpQivGFielqRRJx5ekzo9elhGgGKx-9m1zUzYcoh'; // GAS マイドライブのpractice
  // const srcFileId = '1AS_I_1iAoorcdUqDvEMr4UfrLlx1zkzJa_cXXvwaohU'; // spreadSheet
  // const srcFileId = '1PewdOTCoo99PfIa2oK9_PWQ9y-eGjeDU';  // 3-3のぱそぶー.pptx
  // const srcFileId = '1MrPtcqAqGmbt9rJiOxzA4_YFYEPqHcLpgArX7G5PB6_hOTpyEU-D3YC7'; // 1-3のGAS
  // const srcFileId = '1QmR2_xu1BPOJXPtq-De7Df04O__n_mJU'; // ショートカット
  // const srcFileId = '1tvC7Ai4HFHGnRiKJAhJ1skEfIYaJSotEsFygtEx9RvM'; // マイドライブ上のフォームにリンクされているスプシ
  // const srcFileId = '1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ'; // プライベートアカウントのマイドライブ上のダミーデータ


  // const destFolderId = '1FIFoJSRiYjX6RNb83H13eHJ4nomUchC0'; // 26Adv1st作成班
  const destFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3

  const namedest = 'ショートカットのコピー';
  
  copyFileToDsestFolderById(srcFileId,destFolderId);
}

// 他の関数のJSDocsを書く

function test2oooooooooo(){
  const id = '1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng'; // Lmtg自動送信スプシ
  // const id = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  // const id = '1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ'; // プライベートアカウントのマイドライブ上のダミーデータ

  if(isValidDriveId(id)){
    // const f = DriveApp.getFolderById(id);

    const f = DriveApp.getFileById(id);
    Logger.log(f.getName());
    Logger.log(f.getMimeType());
    Logger.log(haveCopyPermission(id));
  }else{
    Logger.log('finish');
  }
}

function test00000000000000(){
  // const url = 'https://docs.google.com/spreadsheets/d/1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng/edit?gid=0#gid=0'; // Lmtg議事録自動送信
  // const url = 'https://drive.google.com/drive/folders/11zMWmANZKMrQYvcM6hO_DneJHlbmif_H'; // リーダー業務（マイドライブ）
  const url ='https://docs.google.com/spreadsheets/d/1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ/edit?usp=sharing'; // プライベートアカウントのマイドライブ上のダミーデータ

  const id = getIdFromURL(url);
  if(!isValidDriveId(id)){
    Logger.log('無効なドライブIDです');
    
    return 'invalid id';
    // throw new Error('無効なドライブIDです');
  }

  const ftype = getMimeTypeById(id);
  Logger.log(ftype);

  const isCopyable = haveCopyPermission(id) ? '複製可能' : '複製不可' ;

  if(ftype === 'application/vnd.google-apps.folder'){
    const folder = DriveApp.getFolderById(id);
    Logger.log('これはフォルダです。：' + folder.getName());
    
    // return 'folder';
    return 'これはフォルダです。：' + folder.getName();

  }else{
    const file =DriveApp.getFileById(id);
    Logger.log('これは何らかのファイルです。：' + file.getName() + ',' +isCopyable);

    // return 'file';
    return 'これは何らかのファイルです。：' + file.getName() + ',' +isCopyable;
  }
}

/**
 * フォルダIDからファイルイテレータを取得する関数のテスト
 */
function getFolderItems(){
  // const srcFolderId = '17PRLe1GPz-6tFj9oZ1RgtN9uyCc15q-2'; // 1-3のフォルダ
  const srcFolderId = '1V-8BPJ2dDBY1b6Je_D8AyjaPkDS3pJvc'; // 2-1のフォルダ

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
