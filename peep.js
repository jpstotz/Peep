var writeFile = Module.getGlobalExportByName("WriteFile");
var readFile = Module.getGlobalExportByName("ReadFile");

var createFileA = Module.getGlobalExportByName("CreateFileA");
var createFileW = Module.getGlobalExportByName("CreateFileW");

var createNamedPipeA = Module.getGlobalExportByName("CreateNamedPipeA");
var createNamedPipeW = Module.getGlobalExportByName("CreateNamedPipeW");

var callNamedPipe = Module.getGlobalExportByName("CallNamedPipeA");

var createPipe = Module.getGlobalExportByName("CreatePipe");

var GetFileInformationByHandleExAddr = Module.getGlobalExportByName("GetFileInformationByHandleEx");
var GetFileInformationByHandleEx = new NativeFunction(GetFileInformationByHandleExAddr, 'uint32', ['pointer', 'uint32', 'pointer', 'uint32']);

var getFileTypeAddr = Module.getGlobalExportByName('GetFileType');
var getFileType = new NativeFunction(getFileTypeAddr, 'uint32', ['pointer']);

var isPipe = 0;
var pipename;
var pipeHandlers = {};
var otherHandlers = {};
var filename;
var readbuff = 0x0;
var outLenght;

function getPipeName(handle) {
    var buf = Memory.alloc(600);
    if (GetFileInformationByHandleEx(handle, 2 /* FILE_NAME_INFO */, buf, 600) != 0) {
        var fileNameLength = buf.readU32();
        var fileName = buf.add(4).readUtf16String(fileNameLength);
        return fileName;
    }
    return handle;
}

Interceptor.attach(writeFile, {
    onEnter: function (args) {
        /*
        BOOL WriteFile(
        [in]                HANDLE       hFile,
        [in]                LPCVOID      lpBuffer,
        [in]                DWORD        nNumberOfBytesToWrite,
        [out, optional]     LPDWORD      lpNumberOfBytesWritten,
        [in, out, optional] LPOVERLAPPED lpOverlapped
        );
        */
        var len = args[2].toInt32(); // get nNumberOfBytesToWrite
        if (args[0] in pipeHandlers) {
            console.log("\nThread: " + Process.getCurrentThreadId())
            console.log("> Writing to Pipe: " + pipeHandlers[args[0]]);
            console.log("> Content:\n" + hexdump(args[1], { length: len })) + "\n";
        } else if (args[0] in otherHandlers) {
        } else {
            var type = getFileType(args[0]);
            if (type == 3) {
                pipeHandlers[args[0]] = getPipeName(args[0]);
                console.log("\nThread: " + Process.getCurrentThreadId())
                console.log("> Writing to Pipe: " + pipeHandlers[args[0]]);
                console.log("> Content:\n" + hexdump(args[1], { length: len })) + "\n";
            } else {
                otherHandlers[args[0]] = '';
            }
        }
    }
});

Interceptor.attach(readFile, {
    onEnter: function (args) {
        /*
        BOOL ReadFile(
        [in]                HANDLE       hFile,
        [out]               LPVOID       lpBuffer,
        [in]                DWORD        nNumberOfBytesToRead,
        [out, optional]     LPDWORD      lpNumberOfBytesRead,
        [in, out, optional] LPOVERLAPPED lpOverlapped
        );
        */
        outLenght = args[3];
        if (args[0] in pipeHandlers) {
            console.log("\nThread: " + Process.getCurrentThreadId())
            console.log("< Reading from Pipe: " + pipeHandlers[args[0]]);
            readbuff = args[1];
        } else if (args[0] in otherHandlers) {
        } else {
            var type = getFileType(args[0]);
            if (type == 3) {
                pipeHandlers[args[0]] = getPipeName(args[0]);
                console.log("\nThread: " + Process.getCurrentThreadId())
                console.log("< Reading from Pipe: " + pipeHandlers[args[0]]);
                readbuff = args[1];
            } else {
                otherHandlers[args[0]] = '';
            }

        }
    },
    onLeave: function (retval) {
        if (!(readbuff == 0x0)) {
            var len = outLenght.readInt();
            console.log("< Content:\n" + hexdump(readbuff, { length: len }) + "\n");
            readbuff = 0x0;
        }
    }
});

Interceptor.attach(createFileA, {
    onEnter: function (args) {
        /*
        HANDLE CreateFileA(
        [in]           LPCSTR                lpFileName,
        [in]           DWORD                 dwDesiredAccess,
        [in]           DWORD                 dwShareMode,
        [in, optional] LPSECURITY_ATTRIBUTES lpSecurityAttributes,
        [in]           DWORD                 dwCreationDisposition,
        [in]           DWORD                 dwFlagsAndAttributes,
        [in, optional] HANDLE                hTemplateFile
        );
        */
        var args0Str = args[0].readCString();
        if (args0Str.includes("\\\\.\\pipe")) {
            isPipe = 1;
            pipename = args0Str;
        } else {
            isPipe = 0;
        }
    },
    onLeave: function (retval) {
        if (isPipe == 1) {
            //console.log("\nHandler: "+retval);
            if (!(retval in pipeHandlers)) {
                //console.log(retval)
                pipeHandlers[retval] = pipename;
            }
            isPipe = 0;
        } else {
            if (!(retval in otherHandlers)) {
                otherHandlers[retval] = '';
            }
        }
    }
});

Interceptor.attach(createFileW, {
    onEnter: function (args) {
        /*
        HANDLE CreateFileW(
        [in]           LPCWSTR               lpFileName,
        [in]           DWORD                 dwDesiredAccess,
        [in]           DWORD                 dwShareMode,
        [in, optional] LPSECURITY_ATTRIBUTES lpSecurityAttributes,
        [in]           DWORD                 dwCreationDisposition,
        [in]           DWORD                 dwFlagsAndAttributes,
        [in, optional] HANDLE                hTemplateFile
        );
        */
        var args0Str = args[0].readUtf16String();
        if (args0Str.includes("\\\\.\\pipe")) {
            isPipe = 1;
            pipename = args0Str;
        } else {
            isPipe = 0;
        }

    },
    onLeave: function (retval) {
        if (isPipe == 1) {
            //console.log("\nHandler: "+retval);
            if (!(retval in pipeHandlers)) {
                //console.log(retval)
                pipeHandlers[retval] = pipename;
            }
            isPipe = 0;
        } else {
            if (!(retval in otherHandlers)) {
                otherHandlers[retval] = '';
            }
        }
    }
});

Interceptor.attach(createNamedPipeA, {
    onEnter: function (args) {
        /*
        HANDLE CreateNamedPipeA(
        [in]           LPCSTR                lpName,
        [in]           DWORD                 dwOpenMode,
        [in]           DWORD                 dwPipeMode,
        [in]           DWORD                 nMaxInstances,
        [in]           DWORD                 nOutBufferSize,
        [in]           DWORD                 nInBufferSize,
        [in]           DWORD                 nDefaultTimeOut,
        [in, optional] LPSECURITY_ATTRIBUTES lpSecurityAttributes
        );
        Returns file handler
        */
        var args0Str = args[0].readCString();
        console.log("\nPipename: " + args0Str);

        console.log("Open Mode: " + args[1]);
        if (args[1] == 0x3) {
            console.log("Pipe is Duplex");
        } else if (args[1] == 0x1) {
            console.log("Pipe is Read Only");
        } else if (args[1] == 0x2) {
            console.log("Pipe is Write Only");
        } else {
            console.log("Double-check mode:\nhttps://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createnamedpipea");
        }
        if ((args[2] & (1 << 2)) > 0) {
            console.log("Pipe is in MESSAGE mode");
        } else {
            console.log("Pipe is in BYTE mode");
        }
        if ((args[2] & (1 << 1)) > 0) {
            console.log("Pipe is in MESSAGE read mode");
        } else {
            console.log("Pipe is in BYTE read mode");
        }
        if ((args[2] & (1 << 3)) > 0) {
            console.log("Pipe rejects remote clients");
        } else {
            console.log("Pipe accepts remote clients");
        }
        pipename = args0Str;
    },
    onLeave: function (retval) {
        //console.log("Handler: "+retval);
        pipeHandlers[retval] = pipename;
    }
});

Interceptor.attach(createNamedPipeW, {
    onEnter: function (args) {
        /*
        HANDLE CreateNamedPipeW(
        [in]           LPCWSTR               lpName,
        [in]           DWORD                 dwOpenMode,
        [in]           DWORD                 dwPipeMode,
        [in]           DWORD                 nMaxInstances,
        [in]           DWORD                 nOutBufferSize,
        [in]           DWORD                 nInBufferSize,
        [in]           DWORD                 nDefaultTimeOut,
        [in, optional] LPSECURITY_ATTRIBUTES lpSecurityAttributes
        );
        Returns file handler
        */
        var args0Str = args[0].readUtf16String()
        console.log("\nPipename: " + args0Str);
        console.log("Mode: " + args[1]);
        if (args[1] == 0x3) {
            console.log("Pipe is Duplex");
        } else if (args[1] == 0x1) {
            console.log("Pipe is Read Only");
        } else if (args[1] == 0x2) {
            console.log("Pipe is Write Only");
        } else {
            console.log("Double-check mode:\nhttps://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-createnamedpipew");
        }
        console.log("Pipe Mode: " + args[2]);
        if ((args[2] & (1 << 2)) > 0) {
            console.log("Pipe is in MESSAGE mode");
        } else {
            console.log("Pipe is in BYTE mode");
        }
        if ((args[2] & (1 << 1)) > 0) {
            console.log("Pipe is in MESSAGE read mode");
        } else {
            console.log("Pipe is in BYTE read mode");
        }
        if ((args[2] & (1 << 3)) > 0) {
            console.log("Pipe rejects remote clients");
        } else {
            console.log("Pipe accepts remote clients");
        }
        pipename = args0Str;
    },
    onLeave: function (retval) {
        //console.log("\nHandler: "+retval);
        pipeHandlers[retval] = pipename;
    }
});

Interceptor.attach(callNamedPipe, {
    onEnter: function (args) {
        /*
        BOOL CallNamedPipeA(
        [in]  LPCSTR  lpNamedPipeName,
        [in]  LPVOID  lpInBuffer,
        [in]  DWORD   nInBufferSize,
        [out] LPVOID  lpOutBuffer,
        [in]  DWORD   nOutBufferSize,
        [out] LPDWORD lpBytesRead,
        [in]  DWORD   nTimeOut
        );
        */

        console.log("\nTransactional Pipename: " + args[0].readCString());
        // console.log("Input:\n"+hexdump(args[1],{offset: 0, length: args[2]});
    }
});


Interceptor.attach(createPipe, {
    onEnter: function (args) {
        /*
        BOOL CreatePipe(
        [out]          PHANDLE               hReadPipe,
        [out]          PHANDLE               hWritePipe,
        [in, optional] LPSECURITY_ATTRIBUTES lpPipeAttributes,
        [in]           DWORD                 nSize
        );
        */
        console.log("\nAnonymous Pipe Created\nRead Handler: " + args[0] + "\nWrite Handler: " + args[1]);
        pipeHandlers[args[0]] = "Anonymous";
    }
});

