#target photoshop

app.displayDialogs = DialogModes.NO;
var origRuler = app.preferences.rulerUnits;
app.preferences.rulerUnits = Units.PIXELS;

function writeJsonFile(filePath, data) {
    var f = new File(filePath);
    f.open("w");
    var parts = [];
    for (var k in data) {
        var v = data[k];
        if (typeof v === "string") {
            parts.push('"' + k + '": "' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"');
        } else if (typeof v === "boolean" || typeof v === "number") {
            parts.push('"' + k + '": ' + v);
        } else {
            parts.push('"' + k + '": null');
        }
    }
    f.writeln("{" + parts.join(", ") + "}");
    f.close();
}

// Dynamically resolve project directories
var scriptFile = new File($.fileName);
var jsxDir = scriptFile.parent;
var rootDir = jsxDir.parent.parent;
var tempDir = new Folder(rootDir + "/backend/temp");
var resultFile = new File(tempDir + "/ps_status.json");

var result = {
    photoshop_name: app.name,
    photoshop_version: app.version,
    action_loaded: false,
    skinfiner_detected: false,
    native_cs6_supported: true,
    error: ""
};

try {
    // Check if PJK is loaded
    var setCounter = 1;
    while (true) {
        var ref = new ActionReference();
        ref.putIndex(charIDToTypeID("ASet"), setCounter);
        var desc;
        try {
            desc = executeActionGet(ref);
        } catch (e) {
            break;
        }
        var setName = desc.getString(charIDToTypeID("Nm  "));
        if (setName.toLowerCase() === "pjk") {
            result.action_loaded = true;
            break;
        }
        setCounter++;
    }

    // Attempt to load PJK.atn if not yet loaded
    if (!result.action_loaded) {
        var atn = new File(rootDir + "/PJK.atn");
        if (atn.exists) {
            try {
                app.load(atn);
                result.action_loaded = true;
            } catch (e) { }
        }
    }

    // Check for SkinFiner command
    try {
            var sfId = stringIDToTypeID("SkinFiner");
            if (app.isCommandAvailable && app.isCommandAvailable(sfId)) {
                result.skinfiner_detected = true;
            }
    } catch (e) { }

} catch (err) {
    result.error = err.message || err.toString();
}

app.preferences.rulerUnits = origRuler;
writeJsonFile(resultFile.fsName, result);
