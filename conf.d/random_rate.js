require('crypto');

function range(r) {
    var min = r.variables.rand_min;
    var max = r.variables.rand_max;
 
    const randomBuffer = crypto.getRandomValues(new Uint32Array(1));
    let randomNumber = randomBuffer[0] / (0xffffffff + 1); // convert to [0..1]

    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(randomNumber * (max - min + 1)) + min;
}

export default { range }
