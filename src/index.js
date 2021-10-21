const LIBRARIES = {
  FS: require("fs"),
  Path: require("path"),
  HTTPS: require("https"),
  Util: require("util"),
  PayingGoogleTTS: require("@google-cloud/text-to-speech"),

  Skill: require("../../../Libraries/Skill"),
  Audio: require("../../../Audio")
};

class TTSGoogle extends LIBRARIES.Skill{
  constructor(_main, _settings) {
    super(_main, _settings);
    const SELF = this;

    // Nous definissons le dossier racine du skill
    SELF.RootPath = LIBRARIES.Path.join(_main.DirName, "/lib/skills/HeyHeyChicken_NOVA-TTS-Google/src/");
    // Nous definissons le dossier contenant le fichier json d'identification aux services Google
    SELF.JsonPath = LIBRARIES.Path.join(SELF.RootPath, "Put_Your_Google_TTS_Identifiers_Json_File_Here/", "identifiers.json");
    // Nous definissons le dossier contenant les futurs fichiers mp3 à jouer.
    SELF.MP3FolderPath = LIBRARIES.Path.join(_main.DirName, "/public/mp3/TTS/");
    SELF.JsonFileName = "identifiers.json";

    if(SELF.Settings.project_id != null){
      LIBRARIES.FS.writeFileSync(SELF.JsonPath, JSON.stringify(SELF.Settings));
      SELF.PayingClient = new LIBRARIES.PayingGoogleTTS.TextToSpeechClient({
        projectId: SELF.Settings.project_id,
        keyFilename: SELF.JsonPath
      });
    }
    else{
      if(LIBRARIES.FS.existsSync(SELF.JsonPath)){
        LIBRARIES.FS.unlinkSync(SELF.JsonPath);
      }
      _main.Log("NOVA-TTS-Google : No Google TTS identifiers settings found, we'll use the free version of Google TTS. If you want to use the paid version, you have to put your json file content into this skill settings tab.", "white");

    }

    SELF.Main.TTS = function (_socket, _text, _callback){
      if(_text !== undefined){
        if(_text !== undefined){
          if(SELF.Settings.project_id !== null){
            SELF.PayingTTS(_socket, _text, _callback);
          }
          else{
            SELF.FreeTTS(_socket, _text, _callback);
          }
        }
      }
    }
  }

  async PayingTTS(_socket, _text, _callback){
    const SELF = this;

    const request = {
      input: {text: _text},
      voice: {languageCode: this.Main.Settings.Language, ssmlGender: "NEUTRAL"},
      audioConfig: {audioEncoding: "MP3"},
    };

    // Performs the text-to-speech request
    const [response] = await this.PayingClient.synthesizeSpeech(request);
    // Write the binary audio content to a local file
    const writeFile = LIBRARIES.Util.promisify(LIBRARIES.FS.writeFile);

    const NAME  = LIBRARIES.Path.join("/", "mp3/TTS/GoogleTTS-" + new Date().getTime() + ".mp3");

    const FILE_NAME = LIBRARIES.Path.join("/", "GoogleTTS-" + new Date().getTime() + ".mp3");
    const ABSOLUTE_PATH = LIBRARIES.Path.join(SELF.Main.DirName, "/public/mp3/TTS/", FILE_NAME);
    const LOCAL_PATH = LIBRARIES.Path.join( "/mp3/TTS/", FILE_NAME);

    await writeFile(ABSOLUTE_PATH, response.audioContent, "binary");
    _socket.emit("play_audio", [new LIBRARIES.Audio(LOCAL_PATH, SELF.Settings.PlaybackRate)]);
    if(_callback !== undefined){
      _callback(_text);
    }
  }

  FreeTTS(_socket, _text, _callback){
    const SELF = this;

    const MAX_CHARACTERS = 200;
    if(_text.length > MAX_CHARACTERS){
      SELF.Main.Log("Google's free version of TTS does not allow you to use sentences longer than " + MAX_CHARACTERS + " characters.", "red");
      _text = _text.substring(0, MAX_CHARACTERS);
    }

    const FILE_NAME = LIBRARIES.Path.join("/", "GoogleTTS-" + new Date().getTime() + ".mp3");
    const ABSOLUTE_PATH = LIBRARIES.Path.join(SELF.Main.DirName, "/public/mp3/TTS/", FILE_NAME);
    const LOCAL_PATH = "/mp3/TTS/" + FILE_NAME;

    const FILE = LIBRARIES.FS.createWriteStream(ABSOLUTE_PATH);
    const URL = "https://translate.google.com/translate_tts?ie=UTF-8&tl=" + this.Main.Settings.Language + "&client=tw-ob&q=" + encodeURIComponent(_text);
    LIBRARIES.HTTPS.get(URL, function(response) {
      response.pipe(FILE);
      FILE.on("finish", function() {
        FILE.close(function(){
          _socket.emit("play_audio", [new LIBRARIES.Audio(LOCAL_PATH, 1)]);
          if(_callback !== undefined){
            _callback(_text);
          }
        });
      });
    });
  }

}

module.exports = TTSGoogle;
