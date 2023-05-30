// Software License Agreement (ISC License)
//
// Copyright (c) 2023, Matthew Voss
//
// Permission to use, copy, modify, and/or distribute this software for
// any purpose with or without fee is hereby granted, provided that the
// above copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

const jnext = require('qb-json-next')
const jalign = require('qb-json-align')


const TOK = jnext.TOK
const ECODE = jnext.ECODE
const POS = jnext.POS

// error codes and tokens can be combined in one array because they don't intersect (by design).
//    Lookup with TOK_NAMES[tok || ecode]
const TOK_NAMES = []
TOK_NAMES[TOK.ARR] = 'array'
TOK_NAMES[TOK.OBJ] = 'object'
TOK_NAMES[TOK.ARR_END] = 'array_end'
TOK_NAMES[TOK.OBJ_END] = 'object_end'
TOK_NAMES[TOK.NUL] = 'null'
TOK_NAMES[TOK.FAL] = 'false'
TOK_NAMES[TOK.TRU] = 'true'
TOK_NAMES[TOK.STR] = 'string'
TOK_NAMES[TOK.DEC] = 'number'
TOK_NAMES[ECODE.BAD_VALUE] = 'err_bad_value'
TOK_NAMES[ECODE.UNEXPECTED] = 'err_invalid_json'
TOK_NAMES[ECODE.TRUNCATED] = 'src_end_trunc'
TOK_NAMES[ECODE.KEY_NO_VAL] = 'src_end_key'
TOK_NAMES[ECODE.TRUNC_DEC] = 'src_end_decimal'
TOK_NAMES[0] = 'src_end'

class JsonTokenizer {
  constructor (opt = {}) {
    this.nchunks = 0
    this.nbytes = 0
    this.path = []
    this.prev_tok = 0
    this.counts = new Map()
    this.first_chunk_time = 0
    this.last_tok_time = 0

    this.opt = Object.assign({}, opt)
    this.opt.buf2str = opt.buf2str || ((src, off, lim) => Buffer.from(src.slice(off, lim).toString()))
    this.ps = null            // created by calling nextsrc()
  }

  static tok_typestr (tok, ecode, precise = true) {
    if (!precise) {
      switch (tok || ecode) {
        case TOK.OBJ_END:
          tok = TOK.OBJ
          break
        case TOK.ARR_END:
          tok = TOK.ARR
          break
        case 0: case ECODE.TRUNCATED: case ECODE.TRUNC_DEC: case ECODE.KEY_NO_VAL:
          tok = 0
          break
      }
    }
    return TOK_NAMES[tok || ecode]
  }

  nextsrc (src, opt) {
    this.nbytes += src.length
    this.nchunks++
    if (this.nchunks > 1) {
      this.ps.next_src = src
      jalign(this.ps, { new_buf: (len) => Buffer.from(new Uint8Array(len)) })
    } else {
      this.first_chunk_time = Date.now()
      this.ps = jnext.new_ps(src, opt || this.opt)
    }
    return this
  }

  next (opt) {
    if (this.nchunks === 0) {
      throw Error('Before calling next(), JParser expects nextsrc() to be called')
    }
    let ps = this.ps
    if (ps.tok !== 0) {
      this.prev_tok = ps.tok
    }

    jnext.next(ps, opt)
    this.update_path()
    // update time at buffer end
    switch (ps.tok || ps.ecode) {
      case 0:
      case ECODE.TRUNCATED:
      case ECODE.KEY_NO_VAL:
      case ECODE.TRUNC_DEC:
        this.last_tok_time = Date.now()
    }
    return ps.tok
  }
  get depth () {
    let tok = this.ps.tok
    let ret = this.ps.stack.length
    if (tok === TOK.OBJ || tok === TOK.ARR) {
      // this.stack is anticapitory - set for the next token to come. This adjustment makes
      // OBJ and ARR tokens more consistent with other value types for stack context
      ret--
    }
    return ret
  }
  get inobject () {
    return !(this.ps.stack[this.depth - 1] !== TOK.OBJ)    // at depth = 0, inobject() returns false as intended.
  }
  get tok () { return this.ps.tok }

  get valbuf () {
    let ps = this.ps
    if (ps.vlim <= this.ps.voff) {
      return null
    }
    return Buffer.from(ps.src.slice(ps.voff, ps.vlim))
  }

  checke () {
    return jnext.checke(this.ps)
  }

  typestr (precise = true) {
    return JsonTokenizer.tok_typestr(this.ps.tok, this.ps.ecode, precise)
  }

  update_path () {
    let ps = this.ps
    let tok = ps.tok
    let path = this.path

    const d = this.depth
    if (tok === TOK.OBJ_END || tok === TOK.ARR_END) {
      path = this.path = path.slice(0, d + 1)
    } else {
      const v = path[d]
      if (this.inobject) {
        path[d] = ps.key
      } else {
        path[d] = v == null ? 0 : v + 1
      }
    }
  }

  statstr () {
    let ret = []
    let bytesmb = (this.nbytes / (1024 * 1024)).toFixed(2)
    let parse_time_ms = this.last_tok_time - this.first_chunk_time
    ret.push(`${this.nchunks} chunks totaling ${bytesmb} mb, parsed in ${parse_time_ms / 1000} seconds. Token Counts:`)
    const NAME2TOK = Array.from(this.counts.keys()).reduce((obj, tok) => { obj[TOK_NAMES[tok]] = tok; return obj }, {})
    let names = Object.keys(NAME2TOK).sort()
    for (let n of names) {
      ret.push(`   ${n}: ${this.counts.get(NAME2TOK[n]) || 0}`)
    }
    return ret.join('\n')
  }

  leaves (chunk, leaf_cb) {
    this.nextsrc(chunk)
    let ps = this.ps
    while (this.next(ps)) {
      let tok = ps.tok
      if (tok === TOK.OBJ || tok === TOK.ARR) {
        continue
      }
      if (tok === TOK.OBJ_END && this.prev_tok !== TOK.OBJ) {
        continue
      }
      if (tok === TOK.ARR_END && this.prev_tok !== TOK.ARR) {
        continue
      }
      leaf_cb(this)
    }
    leaf_cb(null)   // null indicates finish
  }
}

module.exports = {
  TOK: TOK,
  POS: POS,
  ECODE: ECODE,
  create: (opt) => new JsonTokenizer(opt),
  arr_equal: jnext.arr_equal,
}
