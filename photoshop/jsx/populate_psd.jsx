/**
 * PJK Studio - Photoshop PSD Template Automation Runner
 * Replaces Smart Objects, photo slots, clipping masks, and text layers in any PSD template.
 */

#target photoshop
app.bringToFront();
app.displayDialogs = DialogModes.NO;

// Dynamically resolve project directories relative to this JSX file
var scriptFile = new File($.fileName);
var jsxDir = scriptFile.parent;
var rootDir = jsxDir.parent.parent;
var tempDir = new Folder(rootDir + "/backend/temp");
var argsFile = new File(tempDir + "/psd_args.json");
var resultFile = new File(tempDir + "/psd_result.json");

function writeJsonFile(filePath, data) {
    try {
        var f = new File(filePath);
        f.open("w");
        f.encoding = "UTF-8";
        f.write(data);
        f.close();
    } catch (e) {}
}

function readJsonFile(filePath) {
    try {
        var f = new File(filePath);
        if (!f.exists) return null;
        f.open("r");
        f.encoding = "UTF-8";
        var content = f.read();
        f.close();
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(content);
        }
        return eval("(" + content + ")");
    } catch (e) {
        return null;
    }
}

function findLayerRecursive(parent, targetName) {
    var cleanTarget = targetName.toLowerCase().replace(/[\s_-]+/g, "");
    for (var i = 0; i < parent.layers.length; i++) {
        var l = parent.layers[i];
        var cleanLayerName = l.name.toLowerCase().replace(/[\s_-]+/g, "");
        if (cleanLayerName === cleanTarget || l.name.toLowerCase() === targetName.toLowerCase()) {
            return l;
        }
        if (l.typename === "LayerSet") {
            var found = findLayerRecursive(l, targetName);
            if (found) return found;
        }
    }
    return null;
}

function replaceSmartObject(newFilePath) {
    var idplacedLayerReplaceContents = stringIDToTypeID("placedLayerReplaceContents");
    var desc = new ActionDescriptor();
    var idnull = charIDToTypeID("null");
    desc.putPath(idnull, new File(newFilePath));
    executeAction(idplacedLayerReplaceContents, desc, DialogModes.NO);
}

function main() {
    if (!argsFile.exists) {
        writeJsonFile(resultFile.fsName, '{"success": false, "error": "psd_args.json not found at ' + argsFile.fsName.replace(/\\/g, "/") + '"}');
        return;
    }

    var args = readJsonFile(argsFile.fsName);
    if (!args) {
        writeJsonFile(resultFile.fsName, '{"success": false, "error": "Could not read arguments JSON"}');
        return;
    }

    var templateFile = new File(args.template_path);
    if (!templateFile.exists) {
        writeJsonFile(resultFile.fsName, '{"success": false, "error": "Template PSD does not exist: ' + args.template_path + '"}');
        return;
    }

    var doc = null;
    try {
        doc = app.open(templateFile);
    } catch (e) {
        writeJsonFile(resultFile.fsName, '{"success": false, "error": "Failed to open template in Photoshop: ' + e.toString().replace(/"/g, '\\"') + '"}');
        return;
    }

    var photosReplaced = 0;
    var textsReplaced = 0;

    try {
        // 1. Process Text Replacements
        if (args.text_replacements && args.text_replacements.length > 0) {
            for (var t = 0; t < args.text_replacements.length; t++) {
                var tr = args.text_replacements[t];
                var tLayer = findLayerRecursive(doc, tr.layer_name);
                if (tLayer && tLayer.kind === LayerKind.TEXT) {
                    tLayer.textItem.contents = tr.text;
                    textsReplaced++;
                }
            }
        }

        // 2. Process Photo Replacements
        if (args.photo_replacements && args.photo_replacements.length > 0) {
            for (var p = 0; p < args.photo_replacements.length; p++) {
                var pr = args.photo_replacements[p];
                var photoFile = new File(pr.image_path);
                if (!photoFile.exists) continue;

                var pLayer = findLayerRecursive(doc, pr.layer_name);
                if (!pLayer) continue;

                app.activeDocument = doc;
                doc.activeLayer = pLayer;

                if (pLayer.kind === LayerKind.SMARTOBJECT) {
                    // Native Smart Object replacement
                    replaceSmartObject(photoFile.fsName);
                    photosReplaced++;
                } else {
                    // Standard Layer / Clipping Mask replacement
                    var bounds = pLayer.bounds; // [left, top, right, bottom]
                    var slotW = bounds[2].value - bounds[0].value;
                    var slotH = bounds[3].value - bounds[1].value;
                    var slotCenterX = bounds[0].value + slotW / 2;
                    var slotCenterY = bounds[1].value + slotH / 2;

                    // Open customer photo
                    var photoDoc = app.open(photoFile);
                    photoDoc.selection.selectAll();
                    photoDoc.selection.copy();
                    photoDoc.close(SaveOptions.DONOTSAVECHANGES);

                    // Switch back to master document
                    app.activeDocument = doc;
                    doc.activeLayer = pLayer;

                    // Paste customer photo directly above slot layer
                    var pastedLayer = doc.paste();
                    pastedLayer.move(pLayer, ElementPlacement.PLACEBEFORE);

                    // Scale to fit slot bounds (cover mode)
                    var pBounds = pastedLayer.bounds;
                    var pW = pBounds[2].value - pBounds[0].value;
                    var pH = pBounds[3].value - pBounds[1].value;

                    var scaleX = (slotW / pW) * 100;
                    var scaleY = (slotH / pH) * 100;
                    var scale = Math.max(scaleX, scaleY); // Cover slot completely

                    pastedLayer.resize(scale, scale, AnchorPosition.MIDDLECENTER);

                    // Re-center on slot
                    var newBounds = pastedLayer.bounds;
                    var newCenterX = newBounds[0].value + (newBounds[2].value - newBounds[0].value) / 2;
                    var newCenterY = newBounds[1].value + (newBounds[3].value - newBounds[1].value) / 2;
                    pastedLayer.translate(slotCenterX - newCenterX, slotCenterY - newCenterY);

                    // Apply clipping mask to base layer if base layer is a shape/mask
                    try {
                        pastedLayer.grouped = true;
                    } catch (eClip) {
                        pLayer.visible = false;
                    }

                    photosReplaced++;
                }
            }
        }

        // 3. Save Final Output
        var outputFile = new File(args.output_path);
        outputFile.parent.create();

        var saveOptions = new JPEGSaveOptions();
        saveOptions.embedColorProfile = true;
        saveOptions.formatOptions = FormatOptions.STANDARDBASELINE;
        saveOptions.matte = MatteType.NONE;
        saveOptions.quality = args.jpeg_quality || 12;

        doc.saveAs(outputFile, saveOptions, true, Extension.LOWERCASE);

        // Close master template WITHOUT saving changes
        doc.close(SaveOptions.DONOTSAVECHANGES);

        writeJsonFile(
            resultFile.fsName,
            '{"success": true, "output_path": "' + args.output_path.replace(/\\/g, "/") + '", "photos_replaced": ' + photosReplaced + ', "texts_replaced": ' + textsReplaced + '}'
        );
    } catch (e) {
        if (doc) {
            try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
        }
        writeJsonFile(
            resultFile.fsName,
            '{"success": false, "error": "Photoshop automation error: ' + e.toString().replace(/"/g, '\\"') + '"}'
        );
    }
}

main();
