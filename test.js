// Software License Agreement (ISC License)
//
// Copyright (c) 2018, Matthew Voss
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

var test = require('test-kit').tape()
var utf8 = require('qb-utf8-ez')
var jtokenizer = require('.')

function src_tokens (opt) {
  let tokenizer = jtokenizer.create()
  tokenizer.nextsrc(opt.src)
  if (opt.lim != null) {
    tokenizer.ps.lim = opt.lim    // allow test override
  }
  return token_strings(tokenizer)
}
  

function token_strings (tokenizer) {
  var toks = []
  do {
    var t = tokenizer.next({err: function () {}})     // errors show up in token details, so don't throw errors
    t === tokenizer.tok || err('bad return token: ' + t)
    toks.push(tokenizer.ps.tokstr(tokenizer.tok === 0))    // more details for end token
  } while (tokenizer.ps.tok)
  tokenizer.ps.tokstr(true) === toks[toks.length-1] || err('inconsistent last token: ' + toks[toks.length-1])
  return toks.join(',')
}

function err (msg) { throw Error(msg) }

test('with lim', function (t) {
  t.table_assert([
    [ 'src',                                  'lim', 'exp' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 0,     '!@0:A_BF' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 1,     '!1@0:T:A_BF' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 2,     '!2@0:T:A_BF' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 3,     's3@0,!@3:A_AV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 4,     's3@0,!@4:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 5,     's3@0,!@5:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 6,     's3@0,!1@5:D:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 7,     's3@0,d1@5,!@7:A_AV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 8,     's3@0,d1@5,!@8:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 9,     's3@0,d1@5,!@9:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 10,    's3@0,d1@5,!1@9:T:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 15,    's3@0,d1@5,n@9,!@15:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 20,    's3@0,d1@5,n@9,!5@15:D:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 25,    's3@0,d1@5,n@9,d5@15,!2@23:T:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 30,    's3@0,d1@5,n@9,d5@15,t@23,!1@29:T:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 35,    's3@0,d1@5,n@9,d5@15,t@23,f@29,!@35:A_BV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false,', 50,    's3@0,d1@5,n@9,d5@15,t@23,f@29,!@35:B:A_BV' ],
  ], function (src, lim) {
    return src_tokens({src: utf8.buffer(src), lim: lim})
  })
})

test('various', function (t) {
  t.table_assert([
    [ 'src',                                      'exp' ],
    [ '',                                         '!@0:A_BF' ],
    [ '1',                                        '!1@0:D:A_BF' ],
    [ '1,2,3',                                    'd1@0,d1@2,!1@4:D:A_BV' ],
    [ '[1, 2], 3',                                '[@0,d1@1,d1@4,]@5,!1@8:D:A_BV' ],
    [ '"x"',                                      's3@0,!@3:A_AV' ],
    [ '-3.05',                                    '!5@0:D:A_BF' ],
    [ '\b  true',                                 't@3,!@7:A_AV' ],
    [ '  true',                                   't@2,!@6:A_AV' ],
    [ 'false',                                    'f@0,!@5:A_AV' ],
    [ ' false  ',                                 'f@1,!@8:A_AV' ],
    [ ' false   ',                                'f@1,!@9:A_AV' ],
    [ '[1, 2, 3]',                                '[@0,d1@1,d1@4,d1@7,]@8,!@9:A_AV' ],
    [ '[3.05E-2]',                                '[@0,d7@1,]@8,!@9:A_AV' ],
    [ '[3.05E-2]',                                '[@0,d7@1,]@8,!@9:A_AV' ],
    [ '{"a":1}',                                  '{@0,k3@1:d1@5,}@6,!@7:A_AV' ],
    [ '{"a":1,"b":{}}',                           '{@0,k3@1:d1@5,k3@7:{@11,}@12,}@13,!@14:A_AV' ],
    [ '{"a"  :1}',                                '{@0,k3@1:d1@7,}@8,!@9:A_AV' ],
    [ '{ "a" : 1 }',                              '{@0,k3@2:d1@8,}@10,!@11:A_AV' ],
    [ '"\\""',                                    's4@0,!@4:A_AV' ],
    [ '"\\\\"',                                   's4@0,!@4:A_AV' ],
    [ '\t\t"x\\a\r"  ',                           's6@2,!@10:A_AV' ],
    [ '"\\"x\\"a\r\\""',                          's11@0,!@11:A_AV' ],
    [ ' [0,1,2]',                                 '[@1,d1@2,d1@4,d1@6,]@7,!@8:A_AV' ],
    [ '["a", "bb"] ',                             '[@0,s3@1,s4@6,]@10,!@12:A_AV' ],
    [ '"x", 4\n, null, 3.2e5 , true, false',      's3@0,d1@5,n@9,d5@15,t@23,f@29,!@34:A_AV' ],
    [ '["a",1.3,\n\t{ "b" : ["v", "w"]\n}\t\n ]', '[@0,s3@1,d3@5,{@11,k3@13:[@19,s3@20,s3@25,]@28,}@30,]@34,!@35:A_AV' ],
  ], function (src) {
    return src_tokens({src: utf8.buffer(src)})
  })
})

test('line and lineoff', function (t) {
  t.table_assert([
    [ 'src',                        'next_src',  'exp' ],
    [ '12,',                        '13',        [ 0, 5 ] ],
    [ '12,13',                      '',          [ 0, 5 ] ],
    [ '\n\n12,',                    '13',        [ 2, 5 ] ],
    [ '\n',                         '\n12,13',   [ 2, 5 ] ],
    [ '\n\r',                       '\n\r12,13', [ 2, 5 ] ],
    [ '\n\n12,13',                  '',          [ 2, 5 ] ],
    [ '\n\r\n\r12,13',              '',          [ 2, 5 ] ],
    [ '\n\r\n',                     '\r12,13',   [ 2, 5 ] ],
    [ '\n12,\n13\n',                '',          [ 3, 0 ] ],
    [ ' \n\n12,13\n',                '',          [ 3, 0 ] ],
    [ '12,\n13',                    '',          [ 1, 2 ] ],
    [ '\n12,',                      '13',        [ 1, 5 ] ],
    [ '\n12,13',                    '',          [ 1, 5 ] ],
    [ '\n\r\n\r',                   '12,13',     [ 2, 5 ] ],
    [ '\n\r\n\r12,',                '13',        [ 2, 5 ] ],
    [ '{"a": 45, "b": true}',       '',          [ 0, 20 ] ],
    [ '\n{"a": 45, "b": true}',     '',          [ 1, 20 ] ],
    [ '{"a":\n 45, "b": true}',     '',          [ 1, 15 ] ],
    [ '{"a": 45, "b":\n true}',     '',          [ 1, 6 ] ],
    [ '\n{"a": 45, "b":\n true}',   '',          [ 2, 6 ] ],
    [ '\n\n{"a":\n 45, "b":\n true}', '',        [ 4, 6 ] ],
  ], function (src, next_src) {
    var tokenizer = jtokenizer.create()
    tokenizer.nextsrc(utf8.buffer(src))
    while (tokenizer.next()) {}
    tokenizer.nextsrc(utf8.buffer(next_src))
    while(tokenizer.next()) {}
    let ps = tokenizer.ps
    return [ ps.line, ps.soff + ps.vlim - ps.lineoff ]
  })
})

test('object - no spaces', function (t) {
  t.table_assert(
    [
      [ 'src',            'exp' ],
      [ '',               '!@0:A_BF' ],
      [ '{',              '{@0,!@1:O_BF:{' ],
      [ '{"',             '{@0,k1@1:!@2:T:O_BF:{' ],
      [ '{"a',            '{@0,k2@1:!@3:T:O_BF:{' ],
      [ '{"a"',           '{@0,k3@1:!@4:K:O_AK:{' ],
      [ '{"a":',          '{@0,k3@1:!@5:K:O_BV:{' ],
      [ '{"a":7',         '{@0,k3@1:!1@5:D:O_BV:{' ],
      [ '{"a":71',        '{@0,k3@1:!2@5:D:O_BV:{' ],
      [ '{"a":71,',       '{@0,k3@1:d2@5,!@8:O_BK:{' ],
      [ '{"a":71,"',      '{@0,k3@1:d2@5,k1@8:!@9:T:O_BK:{' ],
      [ '{"a":71,"b',     '{@0,k3@1:d2@5,k2@8:!@10:T:O_BK:{' ],
      [ '{"a":71,"b"',    '{@0,k3@1:d2@5,k3@8:!@11:K:O_AK:{' ],
      [ '{"a":71,"b":',   '{@0,k3@1:d2@5,k3@8:!@12:K:O_BV:{' ],
      [ '{"a":71,"b":2',  '{@0,k3@1:d2@5,k3@8:!1@12:D:O_BV:{' ],
      [ '{"a":71,"b":2}', '{@0,k3@1:d2@5,k3@8:d1@12,}@13,!@14:A_AV' ],
    ], function (src) { return src_tokens({src: utf8.buffer(src)}) })
})

test('array - no spaces', function (t) {
  t.table_assert(
    [
      [ 'input',      'exp' ],
      [ '',           '!@0:A_BF' ],
      [ '[',          '[@0,!@1:A_BF:[' ],
      [ '[8',         '[@0,!1@1:D:A_BF:[' ],
      [ '[83',        '[@0,!2@1:D:A_BF:[' ],
      [ '[83 ',       '[@0,d2@1,!@4:A_AV:[' ],
      [ '[83,',       '[@0,d2@1,!@4:A_BV:[' ],
      [ '[83,"',      '[@0,d2@1,!1@4:T:A_BV:[' ],
      [ '[83,"a',     '[@0,d2@1,!2@4:T:A_BV:[' ],
      [ '[83,"a"',    '[@0,d2@1,s3@4,!@7:A_AV:[' ],
      [ '[83,"a",',   '[@0,d2@1,s3@4,!@8:A_BV:[' ],
      [ '[83,"a",2',  '[@0,d2@1,s3@4,!1@8:D:A_BV:[' ],
      [ '[83,"a",2]', '[@0,d2@1,s3@4,d1@8,]@9,!@10:A_AV' ],
    ], function (src) { return src_tokens({src: utf8.buffer(src)}) })
})

test('array - spaces', function (t) {
  t.table_assert(
    [
      [ 'input',           'exp' ],
      [ '',                '!@0:A_BF' ],
      [ '[',               '[@0,!@1:A_BF:[' ],
      [ '[ ',              '[@0,!@2:A_BF:[' ],
      [ '[ 8',             '[@0,!1@2:D:A_BF:[' ],
      [ '[ 83',            '[@0,!2@2:D:A_BF:[' ],
      [ '[ 83,',           '[@0,d2@2,!@5:A_BV:[' ],
      [ '[ 83, ',          '[@0,d2@2,!@6:A_BV:[' ],
      [ '[ 83, "',         '[@0,d2@2,!1@6:T:A_BV:[' ],
      [ '[ 83, "a',        '[@0,d2@2,!2@6:T:A_BV:[' ],
      [ '[ 83, "a"',       '[@0,d2@2,s3@6,!@9:A_AV:[' ],
      [ '[ 83, "a" ',      '[@0,d2@2,s3@6,!@10:A_AV:[' ],
      [ '[ 83, "a" ,',     '[@0,d2@2,s3@6,!@11:A_BV:[' ],
      [ '[ 83, "a" , ',    '[@0,d2@2,s3@6,!@12:A_BV:[' ],
      [ '[ 83, "a" , 2',   '[@0,d2@2,s3@6,!1@12:D:A_BV:[' ],
      [ '[ 83, "a" , 2 ',  '[@0,d2@2,s3@6,d1@12,!@14:A_AV:[' ],
      [ '[ 83, "a" , 2 ]', '[@0,d2@2,s3@6,d1@12,]@14,!@15:A_AV' ],
    ], function (src) { return src_tokens({src: utf8.buffer(src)}) })
})

test('object - spaces', function (t) {
  t.table_assert(
    [
      [ 'input',          'exp' ],
      [ ' ',              '!@1:A_BF' ],
      [ ' {',             '{@1,!@2:O_BF:{' ],
      [ ' { ',            '{@1,!@3:O_BF:{' ],
      [ ' { "',           '{@1,k1@3:!@4:T:O_BF:{' ],
      [ ' { "a',          '{@1,k2@3:!@5:T:O_BF:{' ],
      [ ' { "a"',         '{@1,k3@3:!@6:K:O_AK:{' ],
      [ ' { "a":',        '{@1,k3@3:!@7:K:O_BV:{' ],
      [ ' { "a": ',       '{@1,k3@3:!@8:K:O_BV:{' ],
      [ ' { "a": "',      '{@1,k3@3:!1@8:T:O_BV:{' ],
      [ ' { "a": "x',     '{@1,k3@3:!2@8:T:O_BV:{' ],
      [ ' { "a": "x"',    '{@1,k3@3:s3@8,!@11:O_AV:{' ],
      [ ' { "a": "x" }',  '{@1,k3@3:s3@8,}@12,!@13:A_AV' ],
      [ ' { "a" ',        '{@1,k3@3:!@7:K:O_AK:{' ],
      [ ' { "a" :',       '{@1,k3@3:!@8:K:O_BV:{' ],
      [ ' { "a" : ',      '{@1,k3@3:!@9:K:O_BV:{' ],
      [ ' { "a" : "',     '{@1,k3@3:!1@9:T:O_BV:{' ],
      [ ' { "a" : "x',    '{@1,k3@3:!2@9:T:O_BV:{' ],
      [ ' { "a" : "x" ',  '{@1,k3@3:s3@9,!@13:O_AV:{' ],
      [ ' { "a" : "x" }', '{@1,k3@3:s3@9,}@13,!@14:A_AV' ],
    ], function (src) { return src_tokens({src: utf8.buffer(src)}) })
})

test('incremental array', function (t) {
  t.table_assert([
    [ 'src1',               'src2',               'exp' ],
    [ '',                   '1,[[[7,89.4],"c"]]', [ '!@0:A_BF', 'd1@0,[@2,[@3,[@4,d1@5,d4@7,]@11,s3@13,]@16,]@17,!@18:A_AV' ] ],
    [ '1,',                 '[[[7,89.4],"c"]]',   [ 'd1@0,!@2:A_BV', '[@0,[@1,[@2,d1@3,d4@5,]@9,s3@11,]@14,]@15,!@16:A_AV' ] ],
    [ '1,[',                '[[7,89.4],"c"]]',    [ 'd1@0,[@2,!@3:A_BF:[', '[@0,[@1,d1@2,d4@4,]@8,s3@10,]@13,]@14,!@15:A_AV' ] ],
    [ '1,[[',               '[7,89.4],"c"]]',     [ 'd1@0,[@2,[@3,!@4:A_BF:[[', '[@0,d1@1,d4@3,]@7,s3@9,]@12,]@13,!@14:A_AV' ] ],
    [ '1,[[[',              '7,89.4],"c"]]',      [ 'd1@0,[@2,[@3,[@4,!@5:A_BF:[[[', 'd1@0,d4@2,]@6,s3@8,]@11,]@12,!@13:A_AV' ] ],
    [ '1,[[[7,',            '89.4],"c"]]',        [ 'd1@0,[@2,[@3,[@4,d1@5,!@7:A_BV:[[[', 'd4@0,]@4,s3@6,]@9,]@10,!@11:A_AV' ] ],
    [ '1,[[[7,89.4]',       ',"c"]]',             [ 'd1@0,[@2,[@3,[@4,d1@5,d4@7,]@11,!@12:A_AV:[[', 's3@1,]@4,]@5,!@6:A_AV' ] ],
    [ '1,[[[7,89.4],',      '"c"]]',              [ 'd1@0,[@2,[@3,[@4,d1@5,d4@7,]@11,!@13:A_BV:[[', 's3@0,]@3,]@4,!@5:A_AV' ] ],
    [ '1,[[[7,89.4],"c"',   ']]',                 [ 'd1@0,[@2,[@3,[@4,d1@5,d4@7,]@11,s3@13,!@16:A_AV:[[', ']@0,]@1,!@2:A_AV' ] ],
    [ '1,[[[7,89.4],"c"]',  ']',                  [ 'd1@0,[@2,[@3,[@4,d1@5,d4@7,]@11,s3@13,]@16,!@17:A_AV:[', ']@0,!@1:A_AV' ] ],
    [ '1,[[[7,89.4],"c"]]', '',                   [ 'd1@0,[@2,[@3,[@4,d1@5,d4@7,]@11,s3@13,]@16,]@17,!@18:A_AV', '!@18:A_AV' ] ],
  ], function (src1, src2) {
    return parse_split([src1, src2])
  })
})

test('incremental array - spaces', function (t) {
  t.table_assert([
    [ 'src1',                        'src2',                        'exp' ],
    [ '',                            ' 1 , [ [ [7,89.4], "c" ] ] ', [ '!@0:A_BF', 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,s3@19,]@23,]@25,!@27:A_AV' ] ],
    [ ' ',                           '1 , [ [ [7,89.4], "c" ] ] ',  [ '!@1:A_BF', 'd1@0,[@4,[@6,[@8,d1@9,d4@11,]@15,s3@18,]@22,]@24,!@26:A_AV' ] ],
    [ ' 1 ',                         ', [ [ [7,89.4], "c" ] ] ',    [ 'd1@1,!@3:A_AV', '[@2,[@4,[@6,d1@7,d4@9,]@13,s3@16,]@20,]@22,!@24:A_AV' ] ],
    [ ' 1 ,',                        ' [ [ [7,89.4], "c" ] ] ',     [ 'd1@1,!@4:A_BV', '[@1,[@3,[@5,d1@6,d4@8,]@12,s3@15,]@19,]@21,!@23:A_AV' ] ],
    [ ' 1 , ',                       '[ [ [7,89.4], "c" ] ] ',      [ 'd1@1,!@5:A_BV', '[@0,[@2,[@4,d1@5,d4@7,]@11,s3@14,]@18,]@20,!@22:A_AV' ] ],
    [ ' 1 , [',                      ' [ [7,89.4], "c" ] ] ',       [ 'd1@1,[@5,!@6:A_BF:[', '[@1,[@3,d1@4,d4@6,]@10,s3@13,]@17,]@19,!@21:A_AV' ] ],
    [ ' 1 , [ ',                     '[ [7,89.4], "c" ] ] ',        [ 'd1@1,[@5,!@7:A_BF:[', '[@0,[@2,d1@3,d4@5,]@9,s3@12,]@16,]@18,!@20:A_AV' ] ],
    [ ' 1 , [ [',                    ' [7,89.4], "c" ] ] ',         [ 'd1@1,[@5,[@7,!@8:A_BF:[[', '[@1,d1@2,d4@4,]@8,s3@11,]@15,]@17,!@19:A_AV' ] ],
    [ ' 1 , [ [ ',                   '[7,89.4], "c" ] ] ',          [ 'd1@1,[@5,[@7,!@9:A_BF:[[', '[@0,d1@1,d4@3,]@7,s3@10,]@14,]@16,!@18:A_AV' ] ],
    [ ' 1 , [ [ [',                  '7,89.4], "c" ] ] ',           [ 'd1@1,[@5,[@7,[@9,!@10:A_BF:[[[', 'd1@0,d4@2,]@6,s3@9,]@13,]@15,!@17:A_AV' ] ],
    [ ' 1 , [ [ [7,',                '89.4], "c" ] ] ',             [ 'd1@1,[@5,[@7,[@9,d1@10,!@12:A_BV:[[[', 'd4@0,]@4,s3@7,]@11,]@13,!@15:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4]',           ', "c" ] ] ',                  [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,!@17:A_AV:[[', 's3@2,]@6,]@8,!@10:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4],',          ' "c" ] ] ',                   [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,!@18:A_BV:[[', 's3@1,]@5,]@7,!@9:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4], ',         '"c" ] ] ',                    [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,!@19:A_BV:[[', 's3@0,]@4,]@6,!@8:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4], "c"',      ' ] ] ',                       [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,s3@19,!@22:A_AV:[[', ']@1,]@3,!@5:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4], "c" ',     '] ] ',                        [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,s3@19,!@23:A_AV:[[', ']@0,]@2,!@4:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4], "c" ]',    ' ] ',                         [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,s3@19,]@23,!@24:A_AV:[', ']@1,!@3:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4], "c" ] ',   '] ',                          [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,s3@19,]@23,!@25:A_AV:[', ']@0,!@2:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4], "c" ] ]',  ' ',                           [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,s3@19,]@23,]@25,!@26:A_AV', '!@1:A_AV' ] ],
    [ ' 1 , [ [ [7,89.4], "c" ] ] ', '',                            [ 'd1@1,[@5,[@7,[@9,d1@10,d4@12,]@16,s3@19,]@23,]@25,!@27:A_AV', '!@27:A_AV' ] ],
  ], function (src1, src2) {
    return parse_split([src1, src2])
  })
})

test('incremental object', function (t) {
  t.table_assert([
    [ 'src1',                  'src2',                  'exp' ],
    [ '',                      '1,{"a":"one","b":[2]}', [ '!@0:A_BF', 'd1@0,{@2,k3@3:s5@7,k3@13:[@17,d1@18,]@19,}@20,!@21:A_AV' ] ],
    [ '1,',                    '{"a":"one","b":[2]}',   [ 'd1@0,!@2:A_BV', '{@0,k3@1:s5@5,k3@11:[@15,d1@16,]@17,}@18,!@19:A_AV' ] ],
    [ '1,{',                   '"a":"one","b":[2]}',    [ 'd1@0,{@2,!@3:O_BF:{', 'k3@0:s5@4,k3@10:[@14,d1@15,]@16,}@17,!@18:A_AV' ] ],
    [ '1,{"a":"one"',          ',"b":[2]}',             [ 'd1@0,{@2,k3@3:s5@7,!@12:O_AV:{', 'k3@1:[@5,d1@6,]@7,}@8,!@9:A_AV' ] ],
    [ '1,{"a":"one",',         '"b":[2]}',              [ 'd1@0,{@2,k3@3:s5@7,!@13:O_BK:{', 'k3@0:[@4,d1@5,]@6,}@7,!@8:A_AV' ] ],
    [ '1,{"a":"one","b":[2]',  '}',                     [ 'd1@0,{@2,k3@3:s5@7,k3@13:[@17,d1@18,]@19,!@20:O_AV:{', '}@0,!@1:A_AV' ] ],
    [ '1,{"a":"one","b":[2]}', '',                      [ 'd1@0,{@2,k3@3:s5@7,k3@13:[@17,d1@18,]@19,}@20,!@21:A_AV', '!@21:A_AV' ] ],
  ], function (src1, src2) {
    return parse_split([src1, src2])
  })
})

test('incomplete', function (t) {
  t.table_assert([
    [ 'src',         'exp' ],
    [ '1, 2,',       'd1@0,d1@3,!@5:A_BV' ],
    [ '[1, 2, ',     '[@0,d1@1,d1@4,!@7:A_BV:[' ],
    [ 'fal',         '!3@0:T:A_BF' ],
    [ '"ab',         '!3@0:T:A_BF' ],
    [ '{"ab":',      '{@0,k4@1:!@6:K:O_BV:{' ],
    [ '"\\\\\\"',    '!5@0:T:A_BF' ],
    [ '[3.05E-2',    '[@0,!7@1:D:A_BF:[' ],
    [ '[3.05E-2,4.', '[@0,d7@1,!2@9:T:A_BV:[' ],
    [ '{"a',         '{@0,k2@1:!@3:T:O_BF:{' ],
    [ '{"a": ',      '{@0,k3@1:!@6:K:O_BV:{' ],
  ], function (src) { return src_tokens({src: utf8.buffer(src)}) })
})

test('bad value', function (t) {
  t.table_assert([
    [ 'src',        'exp' ],
    [ '{"a"q',      '{@0,k3@1:!@4:B:O_AK:{' ],
    [ '{"a":q',     '{@0,k3@1:!@5:B:O_BV:{' ],
    [ '{"a": q',    '{@0,k3@1:!@6:B:O_BV:{' ],
    [ '{"a" :  q',  '{@0,k3@1:!@8:B:O_BV:{' ],
    [ '0*',         '!2@0:B:A_BF' ],
    [ '1, 2.4n',    'd1@0,!4@3:B:A_BV' ],
    [ '{"a": 3^6}', '{@0,k3@1:!2@6:B:O_BV:{' ],
    [ ' 1f',        '!2@1:B:A_BF' ],
    [ '{"a": t,',   '{@0,k3@1:!2@6:B:O_BV:{' ],
  ], function (src) { return src_tokens({src: utf8.buffer(src)}) })
})

test('unexpected value', function (t) {
  t.table_assert([
    [ 'src',              'exp' ],
    [ '"a""b"',           's3@0,!3@3:U:A_AV' ],
    [ '{"a"]',            '{@0,k3@1:!1@4:U:O_AK:{' ],
    [ '{"a""b"}',         '{@0,k3@1:!3@4:U:O_AK:{' ],
    [ '{"a": "b"]',       '{@0,k3@1:s3@6,!1@9:U:O_AV:{' ],
    [ '["a", "b"}',       '[@0,s3@1,s3@6,!1@9:U:A_AV:[' ],
    [ '0{',               'd1@0,!1@1:U:A_AV' ],
    [ '{"a"::',           '{@0,k3@1:!1@5:U:O_BV:{' ],
    [ '{ false:',         '{@0,!5@2:U:O_BF:{' ],
    [ '{ fal',            '{@0,!3@2:U:O_BF:{' ],
    [ '{ fal:',           '{@0,!3@2:U:O_BF:{' ],
    [ '{"a": "b", 3: 4}', '{@0,k3@1:s3@6,!1@11:U:O_BK:{' ],
    [ '{ "a"]',           '{@0,k3@2:!1@5:U:O_AK:{' ],
    [ '{ "a" ]',          '{@0,k3@2:!1@6:U:O_AK:{' ],
    [ '{ "a":]',          '{@0,k3@2:!1@6:U:O_BV:{' ],
    [ '{ "a": ]',         '{@0,k3@2:!1@7:U:O_BV:{' ],
    [ '{ 2.4',            '{@0,!3@2:U:O_BF:{' ],
    [ '[ 1, 2 ] "c',      '[@0,d1@2,d1@5,]@7,!2@9:U:A_AV' ],
    [ '[ 1, 2 ] "c"',     '[@0,d1@2,d1@5,]@7,!3@9:U:A_AV' ],
  ], function (src) { return src_tokens({src: utf8.buffer(src)}) })
})

test('next() errors', function (t) {
  t.table_assert([
    [ 's1',        's2',      's3',               'exp' ],
    [ '[{',     ' true}',     '',                 /unexpected token at 1..5/ ],
    [ '[',      'true, fax',  '',                 /bad value at 6..9/ ],
  ], function (s1, s2, s3) {
    var sources = [s1, s2, s3]
    var tokenizer = jtokenizer.create()
    while (sources.length) {
      tokenizer.nextsrc(utf8.buffer(sources.shift()))
      while (tokenizer.next()) {}
    }
  }, {assert: 'throws'})
})


test.skip('src not finished', function (t) {
  var s1 = utf8.buffer('[1,2,3,4,')
  var s2 = utf8.buffer('5]')

  var ps = {src: s1, next_src: s2 }
  var exp = '[@0,d1@1,d1@3,d1@5,d1@7,d1@0,]@1,!@2:A_AV'
  t.same(src_tokens(ps), exp, t.desc('finished', [s1, s2], exp))
  t.end()
})

test.skip('soff and vcount', function (t) {
  t.table_assert([
    [ 's1',           's2',               's3',            'exp' ],
    [ '[1, ',         '2,3,',             '4]',           { soffs: [ 0, 4, 8 ], vcounts: [ 1, 3, 5 ] } ],
    [ '[ {"a": 7, ',  '"b": [1,2,3] },',  ' true ]',      { soffs: [ 0, 11, 26 ], vcounts: [ 1, 6, 8 ] } ],
  ], function (s1, s2, s3) {
    var sources = [s1, s2, s3]
    var ret = {soffs: [], vcounts: []}
    var ps = {}
    while (sources.length) {
      ps.next_src = utf8.buffer(sources.shift())
      while (next(ps)) {}
      next.checke(ps)
      ret.soffs.push(ps.soff)
      ret.vcounts.push(ps.vcount)
    }
    return ret
  })
})

test.skip('sticky ecode', function (t) {
  t.table_assert([
    [ 'src',     'exp' ],
    [ '',        ', !@0:A_BF, !@0:A_BF' ],
    [ '1',       ', !1@0:D:A_BF, !1@0:D:A_BF' ],
    [ '1,',      'd1@0:A_AV, !@2:A_BV, !@2:A_BV' ],
    [ '1,2',     'd1@0:A_AV, !1@2:D:A_BV, !1@2:D:A_BV' ],
    [ '["',      '[@0:A_BF:[, !1@1:T:A_BF:[, !1@1:T:A_BF:[' ],
    [ '{"',      '{@0:O_BF:{, k1@1:!@2:T:O_BF:{, k1@1:!@2:T:O_BF:{' ],
    [ '["a',     '[@0:A_BF:[, !2@1:T:A_BF:[, !2@1:T:A_BF:[' ],
    [ '{"a',     '{@0:O_BF:{, k2@1:!@3:T:O_BF:{, k2@1:!@3:T:O_BF:{' ],
    [ '{"a"',    '{@0:O_BF:{, k3@1:!@4:K:O_AK:{, k3@1:!@4:K:O_AK:{' ],
    [ '{"a":',   '{@0:O_BF:{, k3@1:!@5:K:O_BV:{, k3@1:!@5:K:O_BV:{' ],
    [ '{"a":"',  '{@0:O_BF:{, k3@1:!1@5:T:O_BV:{, k3@1:!1@5:T:O_BV:{' ],
    [ '{"a":"b', '{@0:O_BF:{, k3@1:!2@5:T:O_BV:{, k3@1:!2@5:T:O_BV:{' ],
    [ '{"a":n',  '{@0:O_BF:{, k3@1:!1@5:T:O_BV:{, k3@1:!1@5:T:O_BV:{' ],
    [ '{"a":no', '{@0:O_BF:{, k3@1:!2@5:B:O_BV:{, k3@1:!2@5:B:O_BV:{' ],
    [ '{t',      '{@0:O_BF:{, !1@1:U:O_BF:{, !1@1:U:O_BF:{' ],
    [ '{7',      '{@0:O_BF:{, !1@1:U:O_BF:{, !1@1:U:O_BF:{' ],
    [ '[tx',     '[@0:A_BF:[, !2@1:B:A_BF:[, !2@1:B:A_BF:[' ],
    [ '{tx',     '{@0:O_BF:{, !1@1:U:O_BF:{, !1@1:U:O_BF:{' ],
    ], function (src) {
    var ps = {src: utf8.buffer(src)}
    var last
    var toks = []
    while (next(ps, {err: function () {}})) {
      last = next.tokstr(ps, 1)
    }
    toks.push(last)
    toks.push(next.tokstr(ps, 1))
    next(ps)
    toks.push(next.tokstr(ps, 1))
    toks[toks.length-1] === toks[toks.length-2] || err('not sticky: ' + toks.join(',   '))
    return toks.join(', ')
  })
})

function parse_split (sources) {
  var ret = []
  let tokenizer = jtokenizer.create()
  while (sources.length) {
    tokenizer.nextsrc(utf8.buffer(sources.shift()))
    ret.push(token_strings(tokenizer))
  }
  return ret
}