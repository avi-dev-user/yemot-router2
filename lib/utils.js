function findLast (arr, fn) { // for node.js under v18
    return [...arr].reverse().find(fn);
}

export function getCallerFile (e) { // based of https://stackoverflow.com/a/47105238/17059718
    if (!e.stack) {
        return {
            filepath: null,
            line: null,
            column: null,
            mergedPath: null
        };
    }

    const callerStack = findLast(e.stack.split('\n'), stack => {
        return !stack.includes('node_modules') && stack !== 'Error' && !stack.includes(__dirname);
    });
    const regex = /(?:at.* )\(?(.*):(\d+):(\d+)\)?$/;
    const match = regex.exec(callerStack);
    if (!match) {
        return {
            filepath: null,
            line: null,
            column: null,
            mergedPath: null
        };
    }
    return {
        filepath: match[1],
        line: match[2],
        column: match[3],
        mergedPath: `${match[1]}:${match[2]}:${match[3]}`
    };
}