// Function to render description with multiple highlighted texts
export const renderDescriptionWithMultipleHighlights = (
    description: string,
    textsToHighlight: string[],
    highlightClass: string = "font-bold"
) => {
    let result: (string | any)[] = [description];

    textsToHighlight.forEach((text, index) => {
    const newResult: (string | any)[] = [];
    result.forEach((part) => {
        if (typeof part === "string") {
        const splitParts = part.split(text);
        splitParts.forEach((splitPart, i) => {
            newResult.push(splitPart);
            if (i < splitParts.length - 1) {
            newResult.push(
                <span key={`${text}-${index}-${i}`} className={highlightClass}>
                {text}
                </span>
            );
            }
        });
        } else {
        newResult.push(part);
        }
    });
    result = newResult;
    });

    return <>{result}</>;
};