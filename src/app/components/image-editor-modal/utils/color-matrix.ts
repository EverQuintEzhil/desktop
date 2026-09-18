export class ColorMatrix {
    // 4x5 matrix stored as 20 scalars (matches img.ly extract.js naming)
    a = 1;
    b = 0;
    c = 0;
    d = 0;
    e = 0;
    f = 0;
    g = 1;
    h = 0;
    i = 0;
    j = 0;
    k = 0;
    l = 0;
    m = 1;
    n = 0;
    o = 0;
    p = 0;
    q = 0;
    r = 0;
    s = 1;
    t = 0;

    constructor(
        a = 1,
        b = 0,
        c = 0,
        d = 0,
        e = 0,
        f = 0,
        g = 1,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 1,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 1,
        t = 0,
    ) {
        this.set(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t);
    }

    set(
        a: number,
        b: number,
        c: number,
        d: number,
        e: number,
        f: number,
        g: number,
        h: number,
        i: number,
        j: number,
        k: number,
        l: number,
        m: number,
        n: number,
        o: number,
        p: number,
        q: number,
        r: number,
        s: number,
        t: number,
    ) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
        this.g = g;
        this.h = h;
        this.i = i;
        this.j = j;
        this.k = k;
        this.l = l;
        this.m = m;
        this.n = n;
        this.o = o;
        this.p = p;
        this.q = q;
        this.r = r;
        this.s = s;
        this.t = t;
    }

    multiply(other: ColorMatrix) {
        const oa = other.a;
        const ob = other.b;
        const oc = other.c;
        const od = other.d;
        const oe = other.e;
        const of = other.f;
        const og = other.g;
        const oh = other.h;
        const oi = other.i;
        const oj = other.j;
        const ok = other.k;
        const ol = other.l;
        const om = other.m;
        const on = other.n;
        const oo = other.o;
        const op = other.p;
        const oq = other.q;
        const or = other.r;
        const os = other.s;
        const ot = other.t;

        const ma = this.a;
        const mb = this.b;
        const mc = this.c;
        const md = this.d;
        const me = this.e;
        const mf = this.f;
        const mg = this.g;
        const mh = this.h;
        const mi = this.i;
        const mj = this.j;
        const mk = this.k;
        const ml = this.l;
        const mm = this.m;
        const mn = this.n;
        const mo = this.o;
        const mp = this.p;
        const mq = this.q;
        const mr = this.r;
        const ms = this.s;
        const mt = this.t;

        const resA = oa * ma + ob * mf + oc * mk + od * mp;
        const resB = oa * mb + ob * mg + oc * ml + od * mq;
        const resC = oa * mc + ob * mh + oc * mm + od * mr;
        const resD = oa * md + ob * mi + oc * mn + od * ms;

        const resF = of * ma + og * mf + oh * mk + oi * mp;
        const resG = of * mb + og * mg + oh * ml + oi * mq;
        const resH = of * mc + og * mh + oh * mm + oi * mr;
        const resI = of * md + og * mi + oh * mn + oi * ms;

        const resK = ok * ma + ol * mf + om * mk + on * mp;
        const resL = ok * mb + ol * mg + om * ml + on * mq;
        const resM = ok * mc + ol * mh + om * mm + on * mr;
        const resN = ok * md + ol * mi + om * mn + on * ms;

        const resP = op * ma + oq * mf + or * mk + os * mp;
        const resQ = op * mb + oq * mg + or * ml + os * mq;
        const resR = op * mc + oq * mh + or * mm + os * mr;
        const resS = op * md + oq * mi + or * mn + os * ms;

        const resE = oa * me + ob * mj + oc * mo + od * mt + oe;
        const resJ = of * me + og * mj + oh * mo + oi * mt + oj;
        const resO = ok * me + ol * mj + om * mo + on * mt + oo;
        const resT = op * me + oq * mj + or * mo + os * mt + ot;

        this.a = resA;
        this.b = resB;
        this.c = resC;
        this.d = resD;
        this.e = resE;
        this.f = resF;
        this.g = resG;
        this.h = resH;
        this.i = resI;
        this.j = resJ;
        this.k = resK;
        this.l = resL;
        this.m = resM;
        this.n = resN;
        this.o = resO;
        this.p = resP;
        this.q = resQ;
        this.r = resR;
        this.s = resS;
        this.t = resT;

        return this;
    }

    getOffsets(): [number, number, number, number] {
        return [this.e, this.j, this.o, this.t];
    }

    toMat4Array(): Float32Array {
        return new Float32Array([
            this.a,
            this.b,
            this.c,
            this.d,
            this.f,
            this.g,
            this.h,
            this.i,
            this.k,
            this.l,
            this.m,
            this.n,
            this.p,
            this.q,
            this.r,
            this.s,
        ]);
    }

    static get IDENTITY() {
        return new ColorMatrix();
    }

    static createBrightnessMatrix(amount: number) {
        const matrix = new ColorMatrix();

        matrix.e = amount;
        matrix.j = amount;
        matrix.o = amount;

        return matrix;
    }

    static createContrastMatrix(amount: number) {
        const matrix = new ColorMatrix();
        const offset = (1 - amount) / 2;

        matrix.a = matrix.g = matrix.m = amount;
        matrix.e = matrix.j = matrix.o = offset;

        return matrix;
    }

    static createSaturationMatrix(amount = 1) {
        const matrix = new ColorMatrix();
        const invAmount = 1 - amount;
        const redMul = 0.2125 * invAmount;
        const greenMul = 0.7154 * invAmount;
        const blueMul = 0.0721 * invAmount;

        matrix.a = redMul + amount;
        matrix.b = greenMul;
        matrix.c = blueMul;
        matrix.f = redMul;
        matrix.g = greenMul + amount;
        matrix.h = blueMul;
        matrix.k = redMul;
        matrix.l = greenMul;
        matrix.m = blueMul + amount;

        return matrix;
    }

    static createExposureMatrix(amount = 0) {
        const exposure = Math.pow(2, amount);

        return new ColorMatrix(exposure, 0, 0, 0, 0, 0, exposure, 0, 0, 0, 0, 0, exposure, 0, 0, 0, 0, 0, 1, 0);
    }
}
