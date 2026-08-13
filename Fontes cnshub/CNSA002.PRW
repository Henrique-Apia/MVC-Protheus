#include "PROTHEUS.CH"
#include "RWMAKE.CH"
#include "TOPCONN.CH"
#include "TOTVS.CH"
#include "FWMBROWSE.CH"
#include "FWMVCDEF.CH"
#include "COLORS.CH"
#include "tlpp-core.th"
#INCLUDE 'tlpp-rest.th'

PUBLISH MODEL REST NAME OS

////////////////////////////////////////////////////////////////////////////////////////////
//FUNCAO PRINCIPAL
User Function CNSA002()

    Local l_oBrowse := Nil
    Private aRotina := MenuDef()

    //Private cNMTEC := ""
    //cNMTEC := Posicione("AA1",4,xFilial("AA1")+__cUserId,"AA1_CODTEC")

    l_oBrowse := FWMBrowse():New()
    If l_oBrowse <> Nil

        l_oBrowse:SetDescription("OS - APIA")
        l_oBrowse:SetAlias("SZ1")

        l_oBrowse:AddLegend("(SZ1->Z1_APROVAD=='S'.OR.SZ1->Z1_APROVAD=='A').AND.SZ1->Z1_FATURAR=='S'",                    "BLUE",     "Aprovada e Faturada")
        l_oBrowse:AddLegend("SZ1->Z1_FATURAR=='S'.AND.SZ1->Z1_APROVAD!='S'.AND.SZ1->Z1_APROVAD!='A'",                    "PINK",     "Faturada sem Aprovacao")
        l_oBrowse:AddLegend("(SZ1->Z1_APROVAD=='S'.OR.SZ1->Z1_APROVAD=='A').AND.SZ1->Z1_FATURAR!='S'",                   "GREEN",    "Aprovada")
        l_oBrowse:AddLegend("SZ1->Z1_APROVAD!='S'.AND.SZ1->Z1_APROVAD!='A'.AND.!Empty(SZ1->Z1_TEC)",                     "YELLOW",   "Aguardando Aprovacao")
        l_oBrowse:AddLegend("SZ1->Z1_APROVAD!='S'.AND.SZ1->Z1_APROVAD!='A'.AND.Empty(SZ1->Z1_TEC)",                      "BR_CANCEL","Negada")

        l_oBrowse:Activate()

    EndIf

Return

///////////////////////////////////////////////////////////////////////////////////
//ROTINA MENU
Static Function MenuDef()

Local aRotina  := {}

	ADD OPTION aRotina TITLE "Pesquisar"    ACTION "AxPesqui"           OPERATION 1 ACCESS 0
	ADD OPTION aRotina TITLE "Visualizar"   ACTION "VIEWDEF.CNSA002"    OPERATION 2 ACCESS 0
    ADD OPTION aRotina TITLE "Incluir"      ACTION "VIEWDEF.CNSA002"    OPERATION 3 ACCESS 0
	ADD OPTION aRotina TITLE "Alterar"      ACTION "VIEWDEF.CNSA002"    OPERATION 4 ACCESS 0
	ADD OPTION aRotina TITLE "Excluir"      ACTION "VIEWDEF.CNSA002"    OPERATION 5 ACCESS 0
    ADD OPTION aRotina TITLE "Copiar"       ACTION "U_COPIAR_OS"        OPERATION 0 ACCESS 0
    ADD OPTION aRotina TITLE "Legenda"      ACTION "U_LEGENDA"          OPERATION 0 ACCESS 0


Return aRotina
//////////////////////////////////////////////////////////////////////////////////////////////
Static Function ViewDef()

    Local l_oView    := Nil
    Local l_oModel   := FWLoadModel("CNSA002")
    Local l_oStruSZ1 := FWFormStruct(2, "SZ1")
    Local l_oStruSZ2 := FWFormStruct(2, "SZ2")
    //Local l_oStruSZ3 := FWFormStruct(2, "SZ3")

    If l_oModel == Nil
        MsgStop("Erro: O Modelo (ModelDef) nao foi carregado.", "Erro")
        Return Nil
    EndIf

    l_oView := FWFormView():New()
    l_oView:SetModel(l_oModel)

    l_oView:AddField("VIEW_SZ1", l_oStruSZ1, "SZ1MASTER")
    l_oView:AddGrid("VIEW_SZ2",  l_oStruSZ2, "SZ2DETAIL")
    //l_oView:AddGrid("VIEW_SZ3",  l_oStruSZ3, "SZ3DETAIL")


    l_oView:CreateHorizontalBox("CABEC", 60)
    l_oView:CreateHorizontalBox("GRID",  40)
    //l_oView:CreateHorizontalBox("GRID3", 25)

    l_oView:SetOwnerView("VIEW_SZ1", "CABEC")
    l_oView:SetOwnerView("VIEW_SZ2", "GRID")
    //l_oView:SetOwnerView("VIEW_SZ3", "GRID3")

    l_oView:EnableTitleView("VIEW_SZ1", "Dados da OS")
    l_oView:EnableTitleView("VIEW_SZ2", "Horas Contratadas")
    //l_oView:EnableTitleView("VIEW_SZ3", "Proposta")

    l_oView:SetCloseOnOk({||.T.})

Return l_oView
///////////////////////////////////////////////////////////////////////////////////////////////////
//MODELAÇÃO
Static Function ModelDef()

    Local l_oModel  := Nil
    Local l_oStrSZ1  := FWFormStruct(1, "SZ1")
    Local l_oStrSZ2  := FWFormStruct(1, "SZ2")
    Local aRelSZ2   := {}
    //Local l_oStrSZ3  := FWFormStruct(1, "SZ3")
    //Local aRelSZ3   := {}

    l_oModel := MPFormModel():New(;
        "FCNSA002",;
        {|oModel| FSZ1TOK(oModel)},;
        {|oModel| FSZ1CAN(oModel)})

    // Tabela pai: SZ1 (OS)
    l_oModel:AddFields(;
        "SZ1MASTER",;
        NIL,;
        l_oStrSZ1,;
        {|_f,_a,_c,_v| FSZ1PosValid(_f,_a,_c,_v)},;
        NIL)

    // Tabela filha 1: SZ2 (horas contratadas) - relacao por cliente
    l_oModel:AddGrid("SZ2DETAIL", "SZ1MASTER", l_oStrSZ2)
    aAdd(aRelSZ2, {"Z2_CODCLI", "Z1_CLI"})
    aAdd(aRelSZ2, {"Z2_LOJA",   "Z1_LOJA"})
    l_oModel:SetRelation("SZ2DETAIL", aRelSZ2, SZ2->(IndexKey(2)))

    //l_oModel:AddGrid("SZ3DETAIL", "SZ1MASTER", l_oStrSZ3)
    //aAdd(aRelSZ3, {"Z3_NUM",    "Z1_NUMPRO"})
    //aAdd(aRelSZ3, {"Z3_CODCLI", "Z1_CLI"})
    //aAdd(aRelSZ3, {"Z3_LOJA",   "Z1_LOJA"})
    //l_oModel:SetRelation("SZ3DETAIL", aRelSZ3, SZ3->(IndexKey(1)))

    l_oModel:SetPrimaryKey({"Z1_FILIAL","Z1_OS"})

Return l_oModel
//////////////////////////////////////////////////////////////////////////////////////////
// Valida os campos do cabecalho (tabela SZ1)
Static Function FSZ1PosValid(p_oField, p_sAcao, p_sCampo, p_vValor)
    Local l_bOk := .T.
    Local aObrigatorios := {"Z1_CLI", "Z1_LOJA", "Z1_USR", "Z1_MODULO", "Z1_MOTIV", ;
        "Z1_SERV", "Z1_TIPO", "Z1_DTOS", "Z1_INI", "Z1_FIM", "Z1_TOTAL", "Z1_TEC"}

    If AScan(aObrigatorios, p_sCampo) > 0 .And. Empty(p_vValor)
        l_bOk := .F.
    EndIf

Return l_bOk

Static Function FSZ1TOK(p_oModel)
    Local l_bOk := .T.
Return l_bOk

Static Function FSZ1CAN(p_oModel)

Return .T.


User Function COPIAR_OS()

    Local aFields   := {}
    Local nI        := 0
    Local cNovaOS   := ""

    If SZ1->(Eof())
        MsgStop("Selecione uma OS para copiar.", "Copiar OS")
        Return
    EndIf

    cNovaOS := AllTrim(SZ1->Z1_OS)

    If !MsgYesNo("Deseja copiar a OS " + cNovaOS + "?", "Copiar OS")
        Return
    EndIf

    // Salva todos os campos do registro atual antes de criar o novo
    DbSelectArea("SZ1")
    For nI := 1 To FCount()
        aAdd(aFields, {FieldName(nI), FieldGet(nI)})
    Next nI

    // Cria novo registro e copia os campos
    If SZ1->(RecLock("SZ1", .T.))
        For nI := 1 To Len(aFields)
            FieldPut(FieldPos(aFields[nI][1]), aFields[nI][2])
        Next nI
        // Campos que devem ser diferentes na copia
        SZ1->Z1_OS      := GetSXENum("SZ1", "Z1_OS")
        SZ1->Z1_DTDIGIT := Date()
        SZ1->Z1_APROVAD := "N"
        SZ1->Z1_FATURAR := "N"
        SZ1->Z1_APVDOR  := ""
        SZ1->Z1_APVMAIL := ""
        SZ1->Z1_APVIP   := ""
        SZ1->Z1_APVDATA := CtoD("")
        SZ1->Z1_APVHORA := ""
        MsUnlock()
        MsgInfo("OS copiada com sucesso! Nova OS: " + AllTrim(SZ1->Z1_OS), "Copiar OS")
    Else
        MsgStop("Erro ao copiar a OS.", "Copiar OS")
    EndIf

Return

User Function LEGENDA()

    BrwLegenda("Legenda de Status", "Status da OS", ;
        { ;
            { "BR_AZUL",      "Faturada e Aprovada"    }, ;
            { "BR_PINK",   "Faturada sem Aprovacao"  }, ;
            { "BR_VERDE",     "Aprovada"               }, ;
            { "BR_AMARELO",   "Aguardando Aprovacao"   }, ;
            { "BR_CANCEL",  "Negada"                 }  ;
        })

Return

////////////////////////////////////////////////////////////////////////////////
// Helpers compartilhados pelos endpoints REST (Incluir/Alterar/Excluir OS).
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA002_ISODATA(cIso)
    If Empty(cIso)
        Return CToD("")
    EndIf
Return StoD(StrTran(cIso, "-", ""))

Static Function CNSA002_JSONNUM(jBody, cCampo)
    Local xVal := jBody[cCampo]
    If xVal == Nil
        Return 0
    EndIf
Return Val(cValToChar(xVal))

Static Function CNSA002_ERROMODEL(oModel)
    Local aErros := oModel:GetErrorMessage()
    Local cMsg   := ""
    Local nI     := 0

    If ValType(aErros) == "A"
        For nI := 1 To Len(aErros)
            If ValType(aErros[nI]) == "A" .And. Len(aErros[nI]) >= 6 .And. !Empty(aErros[nI][6])
                cMsg += aErros[nI][6] + "; "
            EndIf
        Next nI
    EndIf

    If Empty(cMsg)
        cMsg := "Erro de validacao no registro."
    ElseIf Right(cMsg, 2) == "; "
        cMsg := Left(cMsg, Len(cMsg) - 2)
    EndIf

Return cMsg

Static Function CNSA002_RESPOK(cOs, cMsg)
    Local oJson := JsonObject():New()
    oJson["sucesso"]  := .T.
    oJson["os"]       := cOs
    oJson["mensagem"] := EncodeUtf8(cMsg)
Return oJson:ToJson()

Static Function CNSA002_RESPERRO(cErro)
    Local oJson := JsonObject():New()
    oJson["sucesso"] := .F.
    oJson["erro"]    := EncodeUtf8(cErro)
Return oJson:ToJson()

Static Function CNSA002_CAMPOSOBRIGATORIOS()
    Local aCampos := {}
    AAdd(aCampos, {"codCliente",     "o cliente",           .F.})
    AAdd(aCampos, {"lojaCliente",    "o site do cliente",   .F.})
    AAdd(aCampos, {"usuario",        "o usuario",           .F.})
    AAdd(aCampos, {"modulo",         "o modulo",            .F.})
    AAdd(aCampos, {"motivo",         "o motivo",            .F.})
    AAdd(aCampos, {"descricao",      "a descricao",         .F.})
    AAdd(aCampos, {"codServico",     "o codigo do servico", .F.})
    AAdd(aCampos, {"dataOs",         "a data da OS",        .F.})
    AAdd(aCampos, {"horaInicialDec", "a hora inicial",      .T.})
    AAdd(aCampos, {"horaFinalDec",   "a hora final",        .T.})
    AAdd(aCampos, {"horasTiDec",     "as horas TI",         .T.})
    AAdd(aCampos, {"codAnalista",    "o analista",          .F.})
Return aCampos

// lParcial .F. (Incluir): todo campo obrigatorio precisa estar presente e nao-vazio.
// lParcial .T. (Alterar): so valida os campos que VIERAM no body - se vier vazio
// (nao Nil) um campo obrigatorio, rejeita; se nem vier, ignora (parcial de verdade).
Static Function CNSA002_VALIDABODY(jBody, lParcial)
    Local aCampos   := CNSA002_CAMPOSOBRIGATORIOS()
    Local nI        := 0
    Local xVal      := Nil
    Local lPresente := .F.

    For nI := 1 To Len(aCampos)
        xVal      := jBody[aCampos[nI][1]]
        lPresente := xVal <> Nil

        If !lParcial .And. !lPresente
            Return "Informe " + aCampos[nI][2] + "."
        EndIf

        If lPresente .And. !aCampos[nI][3] .And. Empty(AllTrim(cValToChar(xVal)))
            Return "Informe " + aCampos[nI][2] + "."
        EndIf
    Next nI

Return ""

Static Function CNSA002_TEMCAMPO(jBody, aChaves)
    Local nI := 0
    For nI := 1 To Len(aChaves)
        If jBody[aChaves[nI]] <> Nil
            Return .T.
        EndIf
    Next nI
Return .F.

////////////////////////////////////////////////////////////////////////////////
// POST /cnsaos - Inclui uma nova OS (SZ1) via FWModel("CNSA002").
////////////////////////////////////////////////////////////////////////////////
@Post("/cnsaos")
User Function CNSA002_INCLUIR_OS() As Logical
    Local cBody  := oRest:getBodyRequest() As Character
    Local jBody  := JsonObject():New() As Json
    Local oModel := Nil
    Local cOs    := ""
    Local cErro  := ""
    Local cErroBody := "" As Character

    oRest:setKeyHeaderResponse("Content-Type", "application/json")

    If jBody:fromJson(cBody) <> Nil
        Return oRest:setStatusResponse(400, CNSA002_RESPERRO("Body JSON invalido."))
    EndIf

    cErroBody := CNSA002_VALIDABODY(jBody, .F.)
    If !Empty(cErroBody)
        Return oRest:setStatusResponse(400, CNSA002_RESPERRO(cErroBody))
    EndIf

    Try
        cOs := GetSxeNum("SZ1", "Z1_OS")

        oModel := FWLoadModel("CNSA002")
        oModel:SetOperation(MODEL_OPERATION_INSERT)
        oModel:Activate()
        oModel:GetModel("SZ2DETAIL"):SetOptional(.T.)

        oModel:SetValue("SZ1MASTER", "Z1_OS",      cOs)
        oModel:SetValue("SZ1MASTER", "Z1_CLI",     jBody:GetJsonText("codCliente"))
        oModel:SetValue("SZ1MASTER", "Z1_LOJA",    jBody:GetJsonText("lojaCliente"))
        oModel:SetValue("SZ1MASTER", "Z1_USR",     jBody:GetJsonText("usuario"))
        oModel:SetValue("SZ1MASTER", "Z1_MODULO",  jBody:GetJsonText("modulo"))
        oModel:SetValue("SZ1MASTER", "Z1_MOTIV",   jBody:GetJsonText("motivo"))
        oModel:SetValue("SZ1MASTER", "Z1_SERV",    DecodeUTF8(jBody:GetJsonText("descricao")))
        oModel:SetValue("SZ1MASTER", "Z1_TIPO",    jBody:GetJsonText("codServico"))
        oModel:SetValue("SZ1MASTER", "Z1_DTOS",    CNSA002_ISODATA(jBody:GetJsonText("dataOs")))
        oModel:SetValue("SZ1MASTER", "Z1_INI",     CNSA002_JSONNUM(jBody, "horaInicialDec"))
        oModel:SetValue("SZ1MASTER", "Z1_FIM",     CNSA002_JSONNUM(jBody, "horaFinalDec"))
        oModel:SetValue("SZ1MASTER", "Z1_TOTAL",   CNSA002_JSONNUM(jBody, "horasTiDec"))
        oModel:SetValue("SZ1MASTER", "Z1_TEC",     jBody:GetJsonText("codAnalista"))
        oModel:SetValue("SZ1MASTER", "Z1_DTDIGIT", If(Empty(jBody:GetJsonText("dtDigitacao")), Date(), CNSA002_ISODATA(jBody:GetJsonText("dtDigitacao"))))
        oModel:SetValue("SZ1MASTER", "Z1_INTERNO", If(Empty(jBody:GetJsonText("osInterna")), "N", jBody:GetJsonText("osInterna")))
        oModel:SetValue("SZ1MASTER", "Z1_TRANS",   CNSA002_JSONNUM(jBody, "horasTranDec"))
        oModel:SetValue("SZ1MASTER", "Z1_PREVIST", If(Empty(jBody:GetJsonText("prevPmt")), "N", jBody:GetJsonText("prevPmt")))
        oModel:SetValue("SZ1MASTER", "Z1_NUMPRO",  jBody:GetJsonText("numProposta"))
        oModel:SetValue("SZ1MASTER", "Z1_PV",      jBody:GetJsonText("pedVenda"))
        oModel:SetValue("SZ1MASTER", "Z1_ALMOCO",  CNSA002_JSONNUM(jBody, "hrAlmoco"))
        oModel:SetValue("SZ1MASTER", "Z1_PROJET",  jBody:GetJsonText("projeto"))
        oModel:SetValue("SZ1MASTER", "Z1_REVISA",  jBody:GetJsonText("revisao"))
        oModel:SetValue("SZ1MASTER", "Z1_TAREFA",  jBody:GetJsonText("tarefa"))
        oModel:SetValue("SZ1MASTER", "Z1_CHPSD",   jBody:GetJsonText("chamadoHpsd"))
        oModel:SetValue("SZ1MASTER", "Z1_CHHDK",   CNSA002_JSONNUM(jBody, "chamado"))
        oModel:SetValue("SZ1MASTER", "Z1_OSDESE",  If(Empty(jBody:GetJsonText("osDesenv")), "N", jBody:GetJsonText("osDesenv")))
        oModel:SetValue("SZ1MASTER", "Z1_LIN",     jBody:GetJsonText("linhaPv"))
        oModel:SetValue("SZ1MASTER", "Z1_VLRHR",   CNSA002_JSONNUM(jBody, "valorHora"))
        oModel:SetValue("SZ1MASTER", "Z1_APROVAD", "N")
        oModel:SetValue("SZ1MASTER", "Z1_FATURAR", "N")

        If !oModel:VldData()
            cErro := CNSA002_ERROMODEL(oModel)
            oModel:DeActivate()
            RollBackSX8()
            Return oRest:setStatusResponse(400, CNSA002_RESPERRO(cErro))
        EndIf

        If !oModel:CommitData()
            cErro := CNSA002_ERROMODEL(oModel)
            oModel:DeActivate()
            RollBackSX8()
            Return oRest:setStatusResponse(500, CNSA002_RESPERRO(cErro))
        EndIf

        oModel:DeActivate()
        ConfirmSX8()

    Catch oErro
        If oModel <> Nil
            oModel:DeActivate()
        EndIf
        RollBackSX8()
        FWLogMsg("ERROR", , "REST", "CNSA002_INCLUIR_OS", , "01", oErro:Description, 0, 0, {})
        Return oRest:setStatusResponse(500, CNSA002_RESPERRO(oErro:Description))
    EndTry

Return oRest:setStatusResponse(201, CNSA002_RESPOK(cOs, "OS incluida com sucesso."))

////////////////////////////////////////////////////////////////////////////////
// PUT /cnsaos/:os - Altera uma OS (SZ1) existente via FWModel("CNSA002").
// Alteracao PARCIAL - so grava o campo que vier no body (presenca detectada
// por jBody[campo] <> Nil, nao por Empty() - permite mandar 0 de verdade em
// campo numerico, diferente do POUICNSA002.PRW atual que usa Empty()).
////////////////////////////////////////////////////////////////////////////////
@Put("/cnsaos/:os")
User Function CNSA002_ALTERAR_OS() As Logical
    Local jParams := oRest:getPathParamsRequest() As Json
    Local cOs     := AllTrim(jParams["os"]) As Character
    Local cBody   := oRest:getBodyRequest() As Character
    Local jBody   := JsonObject():New() As Json
    Local oModel  := Nil
    Local cErro   := ""
    Local cErroBody := "" As Character

    oRest:setKeyHeaderResponse("Content-Type", "application/json")

    If jBody:fromJson(cBody) <> Nil
        Return oRest:setStatusResponse(400, CNSA002_RESPERRO("Body JSON invalido."))
    EndIf

    cErroBody := CNSA002_VALIDABODY(jBody, .T.)
    If !Empty(cErroBody)
        Return oRest:setStatusResponse(400, CNSA002_RESPERRO(cErroBody))
    EndIf

    If !CNSA002_TEMCAMPO(jBody, {"codCliente", "lojaCliente", "usuario", "modulo", "motivo", ;
        "descricao", "codServico", "dataOs", "horaInicialDec", "horaFinalDec", "horasTranDec", ;
        "horasTiDec", "codAnalista", "osInterna", "prevPmt", "numProposta", "pedVenda", "hrAlmoco", ;
        "projeto", "revisao", "tarefa", "chamadoHpsd", "chamado", "osDesenv", "linhaPv", "valorHora"})
        Return oRest:setStatusResponse(400, CNSA002_RESPERRO("Informe ao menos um campo para alterar."))
    EndIf

    Try
        DbSelectArea("SZ1")
        SZ1->(DbSetOrder(1))
        If !SZ1->(DbSeek(xFilial("SZ1") + cOs))
            Return oRest:setStatusResponse(404, CNSA002_RESPERRO("OS nao encontrada."))
        EndIf

        oModel := FWLoadModel("CNSA002")
        oModel:SetOperation(MODEL_OPERATION_UPDATE)
        oModel:Activate()

        If jBody["codCliente"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_CLI", jBody:GetJsonText("codCliente"))
        EndIf
        If jBody["lojaCliente"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_LOJA", jBody:GetJsonText("lojaCliente"))
        EndIf
        If jBody["usuario"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_USR", jBody:GetJsonText("usuario"))
        EndIf
        If jBody["modulo"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_MODULO", jBody:GetJsonText("modulo"))
        EndIf
        If jBody["motivo"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_MOTIV", jBody:GetJsonText("motivo"))
        EndIf
        If jBody["descricao"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_SERV", DecodeUTF8(jBody:GetJsonText("descricao")))
        EndIf
        If jBody["codServico"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_TIPO", jBody:GetJsonText("codServico"))
        EndIf
        If jBody["dataOs"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_DTOS", CNSA002_ISODATA(jBody:GetJsonText("dataOs")))
        EndIf
        If jBody["horaInicialDec"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_INI", CNSA002_JSONNUM(jBody, "horaInicialDec"))
        EndIf
        If jBody["horaFinalDec"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_FIM", CNSA002_JSONNUM(jBody, "horaFinalDec"))
        EndIf
        If jBody["horasTranDec"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_TRANS", CNSA002_JSONNUM(jBody, "horasTranDec"))
        EndIf
        If jBody["horasTiDec"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_TOTAL", CNSA002_JSONNUM(jBody, "horasTiDec"))
        EndIf
        If jBody["codAnalista"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_TEC", jBody:GetJsonText("codAnalista"))
        EndIf
        If jBody["osInterna"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_INTERNO", jBody:GetJsonText("osInterna"))
        EndIf
        If jBody["prevPmt"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_PREVIST", jBody:GetJsonText("prevPmt"))
        EndIf
        If jBody["numProposta"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_NUMPRO", jBody:GetJsonText("numProposta"))
        EndIf
        If jBody["pedVenda"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_PV", jBody:GetJsonText("pedVenda"))
        EndIf
        If jBody["hrAlmoco"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_ALMOCO", CNSA002_JSONNUM(jBody, "hrAlmoco"))
        EndIf
        If jBody["projeto"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_PROJET", jBody:GetJsonText("projeto"))
        EndIf
        If jBody["revisao"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_REVISA", jBody:GetJsonText("revisao"))
        EndIf
        If jBody["tarefa"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_TAREFA", jBody:GetJsonText("tarefa"))
        EndIf
        If jBody["chamadoHpsd"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_CHPSD", jBody:GetJsonText("chamadoHpsd"))
        EndIf
        If jBody["chamado"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_CHHDK", CNSA002_JSONNUM(jBody, "chamado"))
        EndIf
        If jBody["osDesenv"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_OSDESE", jBody:GetJsonText("osDesenv"))
        EndIf
        If jBody["linhaPv"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_LIN", jBody:GetJsonText("linhaPv"))
        EndIf
        If jBody["valorHora"] <> Nil
            oModel:SetValue("SZ1MASTER", "Z1_VLRHR", CNSA002_JSONNUM(jBody, "valorHora"))
        EndIf

        If !oModel:VldData()
            cErro := CNSA002_ERROMODEL(oModel)
            oModel:DeActivate()
            Return oRest:setStatusResponse(400, CNSA002_RESPERRO(cErro))
        EndIf

        If !oModel:CommitData()
            cErro := CNSA002_ERROMODEL(oModel)
            oModel:DeActivate()
            Return oRest:setStatusResponse(500, CNSA002_RESPERRO(cErro))
        EndIf

        oModel:DeActivate()

    Catch oErro
        If oModel <> Nil
            oModel:DeActivate()
        EndIf
        FWLogMsg("ERROR", , "REST", "CNSA002_ALTERAR_OS", , "01", oErro:Description, 0, 0, {})
        Return oRest:setStatusResponse(500, CNSA002_RESPERRO(oErro:Description))
    EndTry

Return oRest:setStatusResponse(200, CNSA002_RESPOK(cOs, "OS alterada com sucesso."))

////////////////////////////////////////////////////////////////////////////////
// DELETE /cnsaos/:os - Exclui uma OS (SZ1) via FWModel("CNSA002").
////////////////////////////////////////////////////////////////////////////////
@Delete("/cnsaos/:os")
User Function CNSA002_EXCLUIR_OS() As Logical
    Local jParams := oRest:getPathParamsRequest() As Json
    Local cOs     := AllTrim(jParams["os"]) As Character
    Local oModel  := Nil
    Local cErro   := ""

    oRest:setKeyHeaderResponse("Content-Type", "application/json")

    Try
        DbSelectArea("SZ1")
        SZ1->(DbSetOrder(1))
        If !SZ1->(DbSeek(xFilial("SZ1") + cOs))
            Return oRest:setStatusResponse(404, CNSA002_RESPERRO("OS nao encontrada."))
        EndIf

        oModel := FWLoadModel("CNSA002")
        oModel:SetOperation(MODEL_OPERATION_DELETE)
        oModel:Activate()

        If !oModel:VldData()
            cErro := CNSA002_ERROMODEL(oModel)
            oModel:DeActivate()
            Return oRest:setStatusResponse(400, CNSA002_RESPERRO(cErro))
        EndIf

        If !oModel:CommitData()
            cErro := CNSA002_ERROMODEL(oModel)
            oModel:DeActivate()
            Return oRest:setStatusResponse(500, CNSA002_RESPERRO(cErro))
        EndIf

        oModel:DeActivate()

    Catch oErro
        If oModel <> Nil
            oModel:DeActivate()
        EndIf
        FWLogMsg("ERROR", , "REST", "CNSA002_EXCLUIR_OS", , "01", oErro:Description, 0, 0, {})
        Return oRest:setStatusResponse(500, CNSA002_RESPERRO(oErro:Description))
    EndTry

Return oRest:setStatusResponse(200, CNSA002_RESPOK(cOs, "OS excluida com sucesso."))
