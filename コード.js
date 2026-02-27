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
  if (!match) return null;
  return match[0];
}

/**
 * Googleドライブ上で有効なIDかを判定する。有効であれば、ファイルのメタデータを返す。無効であればFALSEを返す。
 * @param {string} id
 * @return {FILE} 
 */
function getDriveMetaData(id) {
  try {
    // IDをキーにしてファイルが取得できるかを検証、できればファイルは存在＆権限ありと判断
    const f = Drive.Files.get(id, { fields: 'id,name,mimeType,capabilities(canCopy,canEdit),shortcutDetails(targetId)' });
    return f;
  } catch (e) {
    return null;
  }
}

/**
 * スプレッドシートのIDから、このスプレッドシートが、フォームの回答の出力先として指定しているかを判定する関数
 * @param id {string} 判定したいスプレッドシートのURL
 * @return {boolean}
 */
function isFormLinked(id){
  const ss = SpreadsheetApp.openById(id);
  const formUrl = ss.getFormUrl();
  if(formUrl){
    Logger.log('Linked Form: ' +formUrl);
    return true;
  }else{
    Logger.log('No Linked Form');
    return false;
  }
}

/**
 * コピーしたいファイルのIDから、保存先、ファイル名を指定してコピーする関数
 * @param {object} srcFile getDriveMetaDataで取得したオブジェクト
 * @param {string} destFolderId コピー先のフォルダID
 * @param {string} [copiedFileName] コピー後のファイル名
 * @return {File} copiedFile コピー後のファイルのファイルオブジェクト
 */
function copyFileToFolder(srcFile,destFolderId,copiedFileName = null){

  const srcFileId = srcFile.id;
  const srcFileMimeType = srcFile.mimeType;
  const srcFileName = srcFile.name;
  const srcFileCanCopy = srcFile.capabilities.canCopy;
  const srcFileShortcutTargetId = srcFile.shortcutDetails?.targetId ?? null; 

  // 複製権限が無いとき
  if(!srcFileCanCopy){
    Logger.log('コピー元ファイルに対する複製権限がありません。');
    // throw new Error('コピー元ファイルに対する複製権限がありません。');
    return null;
  }

  // 名前指定が無い場合は、元ファイルと同じ名前にする
  let fileName;
  Logger.log('input file name : ' + copiedFileName);

  if(copiedFileName){
    fileName = copiedFileName;
  }else{
    fileName = srcFileName;
  }
  Logger.log('created file name : ' + fileName);

  // ファイルのタイプによって処理を分岐

  if(srcFileMimeType === 'application/vnd.google-apps.shortcut' ){
  // ショートカットの場合再生成
    
    try{
      const shortcut = Drive.Files.create(
        {
          name: srcFileName, // 常にオリジナルファイルの名前で生成
          mimeType: 'application/vnd.google-apps.shortcut',
          parents: [destFolderId],
          shortcutDetails: {
            targetId: srcFileShortcutTargetId
          }
        },
        null,
        { fields: "id,name,mimeType" }
      );
      Logger.log('created shortcut :'+ shortcut.id);
      return shortcut;
    }catch(e){
      Logger.log('Shortcut create error: ' + e.message);
      return null;
    }
  }
  else if(srcFileMimeType === 'application/vnd.google-apps.spreadsheet' && isFormLinked(srcFileId) ){
  // フォームの回答の出力先スプシの場合、処理をスキップ

    Logger.log('Skip creation form-linked sheet');
    return null;
  }
  else{
    try{
      const copiedFile = Drive.Files.copy(
        {
          name: fileName,
          parents: [destFolderId]
        },
        srcFileId,
        { fields: "id,name,mimeType" }
      );
      
      // スタンドアロン型のGASプロジェクトの場合は強制的にマイドライブに複製されるので、複製後に改めて移動
      if(srcFileMimeType === 'application/vnd.google-apps.script'){
        Logger.log('mime-type : gas');
        const createdGAS = DriveApp.getFileById(copiedFile.id);
        const destFolder = DriveApp.getFolderById(destFolderId);

        // 目的のフォルダに移動
        createdGAS.moveTo(destFolder);
      }

      Logger.log('copiedFile.id : ' + copiedFile.id);
      return copiedFile;
    }catch(e){
      Logger.log("Copy error: " + e.message);
      return null;
    }
  }
}

/**
 * Googleドライブのフォルダを再帰的にコピーする関数
 * @param {object} srcFolder getDriveMetaDataで取得した形式のファイルオブジェクト
 * @param {string} destFolderId コピー先のフォルダID
 * @param {string} [copiedFolderName] コピー後のフォルダ名
 * @return {File} copiedFolder コピー後のファイルのファイルオブジェクト
 */
function copyFolder(srcFolder,destFolderId,copiedFolderName=null){

  const srcFolderId = srcFolder.id;

  let folderName = '';
  Logger.log('input folder name : ' + copiedFolderName);

  // 再帰の初回の実行時かつ名前指定有りの場合は、名前指定
  if(isTopFolder && copiedFolderName){
    folderName = copiedFolderName;
    isTopFolder = false;
  }else{
    // 元フォルダと同じ名前
    folderName = srcFolder.name;
  }
  Logger.log('created folder name : ' + folderName);


  // フォルダ生成
  const createdFolder = Drive.Files.create(
    {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [destFolderId],
    },
    null,
    { fields: "id,name,mimeType" }
  );

  const children = Drive.Files.list({
    q: `'${srcFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,capabilities(canCopy),shortcutDetails(targetId))'
  }).files;

  for(const child of children){
    if(child.mimeType === 'application/vnd.google-apps.folder'){
      copyFolder(child,createdFolder.id);
    }else{
      copyFileToFolder(child,createdFolder.id);
    }
  }

  return createdFolder;
}

// 複製後のフォルダの名前を指定する場合、再帰関数の初回だけフォルダ名を指定するためのグローバル変数
let isTopFolder = false;

/**
 * フロントから呼ばれるmain関数の予定・・・
 */
function main(srcUrl, qty, destUrl){

  // // 1.オリジナルファイルの確認
  // URLからファイルIDを抽出
  const srcId = getIdFromURL(srcUrl);

  // URLからIDを取り出せなかった場合
  if(!srcId){ 
    Logger.log('コピー元ファイルのURLが無効です。');
    throw new Error('コピー元ファイルのURLが無効です。');
    return -1;
  }

  // APIでメタデータを取得
  const src = getDriveMetaData(srcId);

  // メタデータを所得できなかった場合
  if(!src){
    Logger.log('コピー元ファイルのURLが無効、もしくはアクセス権限がありません。');
    throw new Error('コピー元ファイルのURLが無効、もしくはアクセス権限がありません。');
    return -1;
  }

  // // copyFileToFolder関数に移植したので不要かも
  // // フォルダ以外で複製権限が無いとき（フォルダの場合は常に複製権限無しになる）
  // if(src.mimeType !== 'application/vnd.google-apps.folder' && !src.capabilities.canCopy){
  //   Logger.log('コピー元ファイルに対する複製権限がありません。');
  //   throw new Error('コピー元ファイルに対する複製権限がありません。');
  //   return -1;
  // }

  // // 2.書き込み先の確認
  // URLからファイルIDを抽出
  const destId = getIdFromURL(destUrl);

  // URLからIDを取り出せなかった場合
  if(!destId){ 
    Logger.log('書き込み先フォルダのURLが無効です。');
    throw new Error('書き込み先フォルダのURLが無効です。');
    return -1;
  }

  // APIでメタデータを取得
  const dest = getDriveMetaData(destId);

  // メタデータを所得できなかった場合
  if(!dest){ 
    Logger.log('書き込み先フォルダのURLが無効、もしくはアクセス権限がありません。');
    throw new Error('書き込み先フォルダのURLが無効、もしくはアクセス権限がありません。');
    return -1;
  }

  // 編集権限が無いとき
  if(!dest.capabilities.canEdit){
    Logger.log('書き込み先フォルダに対する編集権限がありません。');
    throw new Error('書き込み先フォルダに対する編集権限がありません。');
    return -1;
  }

  // ファイルの複製（ループ）
  if(src.mimeType !== 'application/vnd.google-apps.folder'){
    // Todo：作成後ファイルの名前指定機能
    for(let i=0 ; i<qty ; i++){
      copyFileToFolder(src,dest.id);
      // 名前指定が無い場合、同じ名前のデータが生成されるので、「_のコピー1」とかにする
    }
  }else{
    // フォルダの複製（再帰）
    for(let i=0 ; i<qty ; i++){
      isTopFolder = true;
      copyFolder(src,dest.id); // Todo
      // 名前指定が無い場合、同じ名前のデータが生成されるので、「_のコピー1」とかにする
    }
  }
}


// APIを用いたフォルダ作成のテスト
function createFolderTest(){

  const destFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  const folderName = 'APIフォルダ作成のテスト';

  // フォルダ生成
  const createdFolder = Drive.Files.create(
    {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [destFolderId],
    },
    null,
    { fields: "id,name,mimeType" }
  );

  Logger.log('createdFolder ID :' + createdFolder.id);
  Logger.log('createdFolder name :' + createdFolder.name);
  Logger.log('createdFolder mimeType :' + createdFolder.mimeType);
}

// APIを用いたフォルダ内アイテム取得のテスト
function queryTest(){

  const srcFolderId = '17PRLe1GPz-6tFj9oZ1RgtN9uyCc15q-2'; // 1-3>25年度のフォルダ
  // const srcFolderId = '1swkNaeoaiCBWhpctrmxojTtDAWIcBNSi' // 1-3のフォルダ（オーナー自分）
  // const srcFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3

  const children = Drive.Files.list({
    q: `'${srcFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,capabilities(canCopy),shortcutDetails(targetId))'
  }).files;

  for(const child of children){
    Logger.log('アイテム名 :' + child.name);
  }

}

function mainTest(){
  const srcUrl = 'https://drive.google.com/drive/u/0/folders/1YFEjUxtzXm2mMWbsY0dpmDnwXLapn-ws'; // konbuの「共有テスト」フォルダ
  // const srcUrl = 'https://drive.google.com/drive/folders/1gv04gZ0FyBGbkakQhBP2pUXF53KaoIA-'; // 「データ複製App_フォーム複製の挙動確認」（マイドライブ）
  // const srcUrl = 'https://docs.google.com/spreadsheets/d/1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng/edit?gid=0#gid=0'; // Lmtg議事録自動送信
  // const srcUrl = 'https://script.google.com/home/projects/1dIcPU4sWCtqazAxm1SreqebhQafhpbdkpdYfKtaD7AVsC2Yiz2YxPGTm/edit'; // このGAS
  // const srcUrl = 'https://docs.google.com/presentation/d/1-fpxrIkw_pUf8iUk-9Zc5lOPhUg1cr5k/edit?usp=drive_link&ouid=106881036912205881453&rtpof=true&sd=true'; // マイドライブ上の25-自己紹介ブック
  // const srcUrl = 'https://script.google.com/d/1WoK7GbhfnOgS1cV4FpQivGFielqRRJx5ekzo9elhGgGKx-9m1zUzYcoh/edit?usp=drive_link'; // GAS マイドライブのpractice
  // const srcUrl = 'https://script.google.com/d/1MrPtcqAqGmbt9rJiOxzA4_YFYEPqHcLpgArX7G5PB6_hOTpyEU-D3YC7/edit?usp=drive_link'; // 1-3のGAS
  // const srcUrl = 'https://docs.google.com/spreadsheets/d/1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ/edit?usp=drive_link'; // プライベートアカウントのマイドライブ上のダミーデータ（GASでアプリ開発）
  // const srcUrl = 'https://docs.google.com/spreadsheets/d/1tvC7Ai4HFHGnRiKJAhJ1skEfIYaJSotEsFygtEx9RvM/edit?usp=drive_link'; // マイドライブ上のフォームにリンクされているスプシ（複製のテスト）
  // const srcUrl = 'https://docs.google.com/spreadsheets/d/1jptLcpaUtOItdCuFi8DwAG10LnnnP2LDY5jvSZS6zUI/edit?usp=drive_link'; // マイドライブ上のフォームにリンクされていないスプシ（フォーム無関係のシート）
  // const srcUrl = 'https://developers.google.com/apps-script/developersdevelopersdevelopersdevelopersreference/spreadsheet/spreadsheet-app?hl=ja'; //無関係のURL

  const destUrl = 'https://drive.google.com/drive/folders/1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  // const destUrl = 'https://drive.google.com/drive/folders/1nLwDNaHWlgokRPHoPP1CAlU8YwfTeXt7?usp=sharing'; // konbuのフォルダ(KOREA)
  // const destUrl = 'https://drive.google.com/drive/folders/1jBziS_X5B2IEktWBUHqrXebshjkZMhHM'; // PCSU_1-3のフォルダ
  // const destUrl = 'https://drive.google.com/drive/folders/1swkNaeoaiCBWhpctrmxojTtDAWIcBNSi'; // 1-3のAdvフォルダ（オーナー自分）
  // const destUrl = 'https://developers.google.com/apps-script/developersdevelopersdevelopersdevelopersreference/spreadsheet/spreadsheet-app?hl=ja'; //無関係のURL

  const qty = 2;

  main(srcUrl,qty,destUrl);
}

// 不要
/**
 * ショートカットを生成する関数
 */
function createDriveShortcut(targetFileId,destFolderId,shortcutName) {
  // const targetFileId = '1-fpxrIkw_pUf8iUk-9Zc5lOPhUg1cr5k'; // .pptx マイドライブ上の自己紹介ブック
  // const targetFileId = '1WoK7GbhfnOgS1cV4FpQivGFielqRRJx5ekzo9elhGgGKx-9m1zUzYcoh'; // GAS マイドライブのpractice
  // const targetFileId = '1AS_I_1iAoorcdUqDvEMr4UfrLlx1zkzJa_cXXvwaohU'; // spreadSheet
  // const targetFileId = '1PewdOTCoo99PfIa2oK9_PWQ9y-eGjeDU';  // 3-3のぱそぶー.pptx
  // const targetFileId = '1MrPtcqAqGmbt9rJiOxzA4_YFYEPqHcLpgArX7G5PB6_hOTpyEU-D3YC7'; // 1-3のGAS
  // const targetFileId = '1QmR2_xu1BPOJXPtq-De7Df04O__n_mJU'; // ショートカット
  // const targetFileId = '1tvC7Ai4HFHGnRiKJAhJ1skEfIYaJSotEsFygtEx9RvM'; // マイドライブ上のフォームにリンクされているスプシ
  // const targetFileId = '1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ'; // プライベートアカウントのマイドライブ上のダミーデータ
  // const targetFileId = '17PRLe1GPz-6tFj9oZ1RgtN9uyCc15q-2'; // 1-3のフォルダ
  // const targetFileId = '1swkNaeoaiCBWhpctrmxojTtDAWIcBNSi' // 1-3のフォルダ（オーナー自分）

  // const destFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  // const destFolderId = '1Cv6n4vgm_c4siFbFNrg00OorDjm6aSD3';
  // const shortcutName = DriveApp.getFileById(targetFileId).getName();

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

  Logger.log('created shortcut :'+ shortcut.id);
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

function testFormLinkedFunction(){
  const id = '1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng'; // Lmtg議事録自動送信
  // const id ='1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ'; // プライベートアカウントのマイドライブ上のダミーデータ
  // const id = '10iviMG7lp3103Z4A1h8EULblP2qvyy1CKp4U2iTCxwU'; // フォームの回答先（挙動テストフォルダのスプシ）

  if(isFormLinked(id)){
    Logger.log('このスプシは、何かのフォームの回答先となっています')
  }
  else{
    Logger.log('このスプシは、フォームの回答先ではありません')
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
  // const srcFileId = '1dIcPU4sWCtqazAxm1SreqebhQafhpbdkpdYfKtaD7AVsC2Yiz2YxPGTm'; // このGASプロジェクト


  // const destFolderId = '1FIFoJSRiYjX6RNb83H13eHJ4nomUchC0'; // 26Adv1st作成班
  const destFolderId = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3

  // const namedest = 'ショートカットのコピー';
  
  copyFileToFolder(getDriveMetaData(srcFileId),destFolderId);
}

// 他の関数のJSDocsを書く

function test2oo(){
  // const id = '1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng'; // Lmtg自動送信スプシ
  // const id = '1Nzfm_YXWyhjWEPImFWtM9-OWAIfZZreJ'; // PCSU_3-3
  // const id = '1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ'; // プライベートアカウントのマイドライブ上のダミーデータ
  // const id = '1-fpxrIkw_pUf8iUk-9Zc5lOPhUg1cr5k'; // .pptx マイドライブ上の自己紹介ブック
  // const id = '1WoK7GbhfnOgS1cV4FpQivGFielqRRJx5ekzo9elhGgGKx-9m1zUzYcoh'; // GAS マイドライブのpractice
  // const id = '1AS_I_1iAoorcdUqDvEMr4UfrLlx1zkzJa_cXXvwaohU'; // spreadSheet
  // const id = '1PewdOTCoo99PfIa2oK9_PWQ9y-eGjeDU';  // 3-3のぱそぶー.pptx
  // const id = '1MrPtcqAqGmbt9rJiOxzA4_YFYEPqHcLpgArX7G5PB6_hOTpyEU-D3YC7'; // 1-3のGAS
  // const id = '1QmR2_xu1BPOJXPtq-De7Df04O__n_mJU'; // ショートカット
  // const id = '1tvC7Ai4HFHGnRiKJAhJ1skEfIYaJSotEsFygtEx9RvM'; // マイドライブ上のフォームにリンクされているスプシ
  // const id = '1dIcPU4sWCtqazAxm1SreqebhQafhpbdkpdYfKtaD7AVsC2Yiz2YxPGTm'; // このGASプロジェクト

  const f = getDriveMetaData(id)

  if(f){
    Logger.log(f.name);
    Logger.log(f.mimeType);
    Logger.log(f.capabilities.canCopy);
    Logger.log(f.shortcutDetails?.targetId ?? null);

  }else{
    Logger.log('finish');
  }
}

function test00000000000000(){
  // const url = 'https://docs.google.com/spreadsheets/d/1craBclvCdit5RVRpxjCpoiAH4b91SqUgGAXgI-g_2Ng/edit?gid=0#gid=0'; // Lmtg議事録自動送信
  // const url = 'https://drive.google.com/drive/folders/11zMWmANZKMrQYvcM6hO_DneJHlbmif_H'; // リーダー業務（マイドライブ）
  const url ='https://docs.google.com/spreadsheets/d/1Q97-i8yOWrZORHFVVruKLrmeIbVQHU3YNWQDP300WEQ/edit?usp=sharing'; // プライベートアカウントのマイドライブ上のダミーデータ

  const id = getIdFromURL(url);
  if(!getDriveMetaData(id)){
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

// DriveAPIを用いたコピーのテスト
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
