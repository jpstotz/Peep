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

var pipeHandlers = {};
var otherHandlers = {};

function getPipeName(handle) {
    var buf = Memory.alloc(600);
    if (GetFileInformationByHandleEx(handle, 2 /* FILE_NAME_INFO */, buf, 600) != 0) {
        var fileNameLength = buf.readU32();
        var fileName = buf.add(4).readUtf16String(fileNameLength);
        return fileName;
    }
    return handle;
}

function dateTimeStr() {
    return new Date().toISOString();
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
            console.log("\n" + dateTimeStr() + " Thread: " + Process.getCurrentThreadId())
            console.log("> Writing to Pipe: " + pipeHandlers[args[0]]);
            console.log("> Content (" + len + " bytes):\n" + hexdump(args[1], { length: len })) + "\n";
        } else if (args[0] in otherHandlers) {
        } else {
            var type = getFileType(args[0]);
            if (type == 3) {
                pipeHandlers[args[0]] = getPipeName(args[0]);
                console.log("\n" + dateTimeStr() + " Thread: " + Process.getCurrentThreadId())
                console.log("> Writing to Pipe: " + pipeHandlers[args[0]]);
                console.log("> Content (" + len + ") bytes:\n" + hexdump(args[1], { length: len })) + "\n";
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
        this.outLength = args[3];
        var enableOnLeave = false;
        if (args[0] in pipeHandlers) {
            console.log("\n" + dateTimeStr() + " Thread: " + Process.getCurrentThreadId())
            console.log("< Reading from Pipe: " + pipeHandlers[args[0]]);
            this.readbuff = args[1];
            this.enableOnLeave = true;
        } else if (args[0] in otherHandlers) {
        } else {
            var type = getFileType(args[0]);
            if (type == 3) {
                pipeHandlers[args[0]] = getPipeName(args[0]);
                console.log("\n" + dateTimeStr() + " Thread: " + Process.getCurrentThreadId())
                console.log("< Reading from Pipe: " + pipeHandlers[args[0]]);
                this.readbuff = args[1];
                this.enableOnLeave = true;
            } else {
                otherHandlers[args[0]] = '';
            }
        }
    },
    onLeave: function (retval) {
        if (retval != 0 && this.enableOnLeave && !this.readbuff.isNull()) {
            var len = this.outLength.readU32();
            console.log("< Content (" + len + " bytes):");
            if (len > 0) {
                console.log(hexdump(this.readbuff, { length: len }));
            }
            console.log();
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
        var pipename = args[0].readCString();
        if (pipename.includes("\\\\.\\pipe")) {
            this.isPipe = true;
            this.pipename = pipename;
        } else {
            this.isPipe = false;
        }
    },
    onLeave: function (retval) {
        if (this.isPipe) {
            //console.log("\nHandler: "+retval);
            if (!(retval in pipeHandlers)) {
                //console.log(retval)
                pipeHandlers[retval] = this.pipename;
            }
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
        var filename = args[0].readUtf16String();
        if (filename.includes("\\\\.\\pipe")) {
            this.isPipe = true;
            this.pipename = filename;
        } else {
            this.isPipe = false;
        }

    },
    onLeave: function (retval) {
        if (this.isPipe) {
            //console.log("\nHandler: "+retval);
            if (!(retval in pipeHandlers)) {
                //console.log(retval)
                pipeHandlers[retval] = this.pipename;
            }
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
        var pipename = args[0].readCString();
        console.log("\nPipename: " + pipename);

        var openMode = args[1].toInt32();
        console.log("Open Mode: " + openMode);
        if (openMode == 0x3) {
            console.log("Pipe is Duplex");
        } else if (openMode == 0x1) {
            console.log("Pipe is Read Only");
        } else if (openMode == 0x2) {
            console.log("Pipe is Write Only");
        } else {
            console.log("Unknown Open Mode in CreateNamedPipe: " + openMode);
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
        this.pipename = pipename;
    },
    onLeave: function (retval) {
        //console.log("Handler: "+retval);
        pipeHandlers[retval] = this.pipename;
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
        var pipename = args[0].readUtf16String();
        console.log("\nPipename: " + pipename);
        var openMode = args[1].toInt32();
        console.log("Open Mode: " + openMode);
        if (openMode == 0x3) {
            console.log("Pipe is Duplex");
        } else if (openMode == 0x1) {
            console.log("Pipe is Read Only");
        } else if (openMode == 0x2) {
            console.log("Pipe is Write Only");
        } else {
            console.log("Unknown Open Mode in CreateNamedPipeW: " + openMode);
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
        this.pipename = pipename;
    },
    onLeave: function (retval) {
        //console.log("\nHandler: "+retval);
        pipeHandlers[retval] = this.pipename;
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
