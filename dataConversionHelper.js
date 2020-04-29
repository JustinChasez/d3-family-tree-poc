var convertType = {
    'paternal-grandmother': (data, outputJson, awaitingNode) => {
        const model = outputJson.find(x => x.id === data.relID);
        if (model) {
            model.name = data.name;
            model.className = "woman";
        } else {
            outputJson.push({
                name: data.name,
                id: data.relID,
                className: "woman"
            });
        }
    },
    'sister': (data, outputJson) => {
        const model = outputJson.find(x => x.id === data.relID);
    }
}

function convertTcData(input) {
    let inputObj = input;
    if (typeof input === 'string') {
        inputObj = JSON.parse(input);
    }

    const output = [];
    const awaitingNode = [];
    console.log(input);

    inputObj.forEach(x => {
        // check for MomID & DadID, if 0 => root nodes
        if (x.data.MomID === 0 && x.data.DadID === 0) {
            // check if node exist.

            // if not exist, add to the top
            output.splice(0,0, {

            });
        }
        // find MomID / DadID to create connection to the node x

        // add the x to Mom/Dad node

        if (convertType[x.type]) {
            convertType[x.type](x.data, output, awaitingNode);
        }
    });

    console.log(output);

    return output;
}
