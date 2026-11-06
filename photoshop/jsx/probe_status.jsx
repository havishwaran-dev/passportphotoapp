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

var result = {
    photoshop_name: app.name,
    photoshop_version: app.version,
    action_loaded: false,
    skinfiner_detected: false,
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
        var atn = new File("C:/FreePro/passportphotoapp/PJK.atn");
        if (atn.exists) {
            try {
                app.load(atn);
                result.action_loaded = true;
            } catch(e) {}
        }
    }

    // Probe SkinFiner
    // SkinFiner installs as a 8bf plugin under Plug-ins or Common Files
    // Also in Photoshop system info
    try {
        var appRef = new ActionReference();
        appRef.putEnumerated(charIDToTypeID("capp"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var appDesc = executeActionGet(appRef);
        if (appDesc.hasKey(charIDToTypeID("SstI"))) {
            var sinfo = appDesc.getString(charIDToTypeID("SstI"));
            if (sinfo.toLowerCase().indexOf("skinfiner") >= 0) {
                result.skinfiner_detected = true;
            }
        }
    } catch(eProbe) {}

} catch(err) {
    result.error = err.message || err.toString();
}

app.preferences.rulerUnits = origRuler;
writeJsonFile("C:/FreePro/passportphotoapp/backend/temp/ps_probe_result.json", result);
