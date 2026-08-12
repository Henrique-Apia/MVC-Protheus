#Include "Totvs.ch"
#Include "FWMVCDef.ch"

PUBLISH MODEL REST NAME agenda 

User Function CNSA003()
Local oBrowse := Nil
Private aRotina := MenuDef()

oBrowse := FWMBrowse():New()
If oBrowse <> Nil
	oBrowse:SetDescription("Agendas dos Técnicos") 
    oBrowse:SetAlias('SZ6') 
	oBrowse:Activate()
EndIf

Return

Static Function MenuDef()

Return FWMVCMenu('CNSA003')

Static Function ModelDef()
Local oModel
Local ostruSZ6

ostruSZ6:=FWFormStruc(1,'SZ6')
oModel:=MPFormModel():New('ModelSZ6')
//oModel := MPFormModel():New('ModelSZ6', , , {|| U_CNS003VldH()}, )
oModel:AddFields('ModelSZ6_Main',,oStruSZ6)
oModel:SetPrimaryKey({'Z6_FILIAL','Z6_DTAGE','Z6_TECNICO','Z6_SEQ'})
oModel:SetDescription('Model Agendas')
oModel:GetModel('ModelSZ6_Main'):SetDescription('Model Agendas Main')

Return oModel

Static Function ViewDef()
Local oView
Local oModel
Local oStruSZ6

oModel:=ModelDef() //Se não estivesse nesse fonte oModel:=FWLoadModel('CNSA003')

oView:=FWFormView():New()
oView:SetModel(oModel)

oStruSZ6:=FWFormStruc(2,'SZ6')

oView:AddField('ViewSZ6',oStruSZ6,'ModelSZ6_Main')

oView:CreateHorizontalBox('Tela',100)
oView:SetOwnerView('ViewSZ6','Tela')
oView:SetViewProperty('ViewSZ6','SETCOLUMNSEPARTOR',{10})
oView:SetCloseOnOk({||,.T.})

Return oView

// Próxima sequencia de agenda - cadastrada no sx7 e sx3 (inicializador) 
User Function CNS003Seq()
Local oModel  := FWModelActive()
Local dDtAge  := CToD("")
Local cTec    := ""
Local cDtAge  := ""
Local cSeqAnt := ""
Local cSeq    := ""

dDtAge := oModel:GetValue('ModelSZ6_Main', 'Z6_DTAGE')
cTec   := oModel:GetValue('ModelSZ6_Main', 'Z6_TECNICO')

If Empty(dDtAge) .Or. Empty(cTec)
    oModel:SetValue('ModelSZ6_Main', 'Z6_SEQ', '001')
    Return '001'
EndIf

cDtAge := DToS(dDtAge)
DbSelectArea("SZ6")
SZ6->(DbSetOrder(1))
If SZ6->(DbSeek(xFilial("SZ6") + cDtAge + cTec))
    While !SZ6->(Eof()) .And. ;
          SZ6->Z6_FILIAL  == xFilial("SZ6") .And. ;
          DToS(SZ6->Z6_DTAGE) == cDtAge .And. ;
          SZ6->Z6_TECNICO == cTec
        cSeqAnt := SZ6->Z6_SEQ
        SZ6->(DbSkip())
    EndDo
    cSeq := StrZero(Val(cSeqAnt) + 1, Len(SZ6->Z6_SEQ))
Else
    cSeq := StrZero(1, Len(SZ6->Z6_SEQ))
EndIf

oModel:SetValue('ModelSZ6_Main', 'Z6_SEQ', cSeq)
Return cSeq

// Gatilho nome técnico — cadastrado no sx7 
User Function CNS003NTec()
Local oModel:= FWModelActive()
Local cCod  := oModel:GetValue('ModelSZ6_Main','Z6_TECNICO')
Local cNome := Posicione("AA1", 1, xFilial("AA1") + cCod, "AA1_NOMTEC")
oModel:SetValue('ModelSZ6_Main','Z6_NOMTEC',cNome)
Return cNome

// Gatilho nome cliente — cadastrado no sx7
User Function CNS003NCli()
Local oModel:= FWModelActive()
Local cCod  := oModel:GetValue('ModelSZ6_Main','Z6_CLIENTE')
Local cLoja := oModel:GetValue('ModelSZ6_Main','Z6_LOJA')
Local cNome := Posicione("SA1", 1, xFilial("SA1") + cCod + cLoja, "A1_NREDUZ")
oModel:SetValue('ModelSZ6_Main','Z6_NOMCLI',cNome)
Return cNome

// Gatilho p/ preencher data legado - cadastrado no sx7
User Function CNS003DtLg()
Local oModel := FWModelActive()
Local dDtAge := oModel:GetValue('ModelSZ6_Main','Z6_DTAGE')
Local cData := DToS(dDtAge)
oModel:SetValue('ModelSZ6_Main','Z6_DATA',cData)
Return cData

// Validação de sobreposição de horários
User Function CNS003VldH()
//Local oModel := FWModelActive()
Local lRet   := .T.

MsgStop("Validação de sobreposição de horário não implementada.", "Atenção")

Return lRet





