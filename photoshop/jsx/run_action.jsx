#target photoshop

// =========================================================================
// PJK Passport Photo Automation Studio - Action Runner ExtendScript
// =========================================================================

app.displayDialogs = DialogModes.NO;
var origRuler = app.preferences.rulerUnits;
app.preferences.rulerUnits = Units.PIXELS;

function readJsonFile(filePath) {
    var f = new File(filePath);
    if (!f.exists) return null;
    f.open("r");
    var content = f.read();
    f.close();
    
    // Simple JSON parser for basic flat object
    try {
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(content);
        }
    } catch(e) {}
    
    // Fallback eval parser
    return eval("(" + content + ")");
}

function writeJsonFile(filePath, data) {
    var f = new File(filePath);
    f.open("w");
    var str = "";
    try {
        if (typeof JSON !== "undefined" && JSON.stringify) {
            str = JSON.stringify(data);
        }
    } catch(e) {}
    if (!str) {
        // Fallback manual serializer
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
        str = "{" + parts.join(", ") + "}";
    }
    f.writeln(str);
    f.close();
}

var argsFile = "C:/FreePro/passportphotoapp/backend/temp/ps_args.json";
var resultFile = "C:/FreePro/passportphotoapp/backend/temp/ps_result.json";

var result = {
    success: false,
    error: null,
    plugin_missing: false,
    details: "",
    output_path: ""
};

try {
    var args = readJsonFile(argsFile);
    if (!args) {
        throw new Error("Could not read args file: " + argsFile);
    }
    if (args.result_file) {
        resultFile = args.result_file;
    }

    var inputPath = args.input_path;
    var outputPath = args.output_path;
    var atnPath = args.action_file || "C:/FreePro/passportphotoapp/PJK.atn";
    var actionSet = args.action_set || "PJK";
    var actionName = args.action_name || "passport";

    var inputFile = new File(inputPath);
    if (!inputFile.exists) {
        throw new Error("Input file does not exist: " + inputPath);
    }

    // 1. Ensure action file is loaded into Photoshop
    var atnFile = new File(atnPath);
    if (atnFile.exists) {
        try {
            app.load(atnFile);
        } catch(loadErr) {
            // Already loaded or non-fatal
        }
    }

    // 2. Open the input image
    var doc = app.open(inputFile);

    // 3. Execute the action
    try {
        var idPly = charIDToTypeID("Ply ");
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putName(charIDToTypeID("Actn"), actionName);
        ref.putName(charIDToTypeID("ASet"), actionSet);
        desc.putReference(charIDToTypeID("null"), ref);
        executeAction(idPly, desc, DialogModes.NO);
        result.details = "Action '" + actionName + "' in set '" + actionSet + "' completed successfully.";
        result.success = true;
    } catch(actionErr) {
        var errMsg = actionErr.message || actionErr.toString();
        result.error = errMsg;
        if (errMsg.toLowerCase().indexOf("skinfiner") >= 0 || errMsg.toLowerCase().indexOf("filter") >= 0) {
            result.plugin_missing = true;
            result.error = "SkinFiner plugin is required by action '" + actionName + "' but was not found or failed: " + errMsg;
        }
        throw new Error(result.error);
    }

    // 4. Save the active document to outputPath
    if (app.documents.length > 0) {
        var activeDoc = app.activeDocument;
        var saveFile = new File(outputPath);
        var jpgOptions = new JPEGSaveOptions();
        jpgOptions.quality = args.jpeg_quality ? args.jpeg_quality : 12;
        jpgOptions.embedColorProfile = true;
        jpgOptions.formatOptions = FormatOptions.STANDARDBASELINE;
        activeDoc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
        result.output_path = outputPath;

        // Close all documents
        while (app.documents.length > 0) {
            app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
    } else {
        result.output_path = outputPath;
    }

} catch(err) {
    result.success = false;
    if (!result.error) {
        result.error = err.message || err.toString();
    }
    // Safely close any remaining open documents
    try {
        while (app.documents.length > 0) {
            app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
    } catch(closeErr) {}
}

app.preferences.rulerUnits = origRuler;
writeJsonFile(resultFile, result);
